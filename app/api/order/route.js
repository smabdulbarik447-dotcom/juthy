import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql, ensureTables } from "@/lib/db";
import { getSettings, getProducts, deliveryOptions, deliveryCharge } from "@/lib/store";
import { checkOrder, clientIp } from "@/lib/fraud";
import { notifyNewOrder } from "@/lib/telegram";
import { sendPurchase } from "@/lib/fbcapi";
import { bdcKey, checkPhoneSafe, alertLowRating } from "@/lib/bdcourier";

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !/^01[3-9]\d{8}$/.test(body.phone || "") || !body.address) {
    return Response.json({ ok: false, error: "সব তথ্য সঠিকভাবে দিন" }, { status: 400 });
  }

  try {
    await ensureTables();
    const [settings, products] = await Promise.all([getSettings(), getProducts()]);
    const ip = clientIp(req);

    // Fraud check ar courier rating ek shathe (cache e thakle rating sathe sathe ashe)
    const guardOn = settings.bdc_guard === "on" && Boolean(bdcKey(settings));
    const [problem, h] = await Promise.all([
      checkOrder({ phone: body.phone, ip, name: body.name, address: body.address, honeypot: body.website, settings }),
      guardOn ? checkPhoneSafe(body.phone, { timeoutMs: 1000 }) : null,
    ]);
    const min = Math.min(100, Math.max(1, Number(settings.bdc_guard_min) || 65));
    const isLow = (x) => x?.total > 0 && x.rate < min;
    if (problem?.silent) return Response.json({ ok: true, id: 0 });
    if (problem) return Response.json({ ok: false, error: problem.error }, { status: problem.status });

    // Courier rating kom (ager parcel beshi return) hole order nei na — call korte boli. Notun customer / API kaj na korle order hoy
    // (form age-i rating check shesh kore order pathay, tai beshir bhag shomoy cache theke sathe sathe ashe)
    if (guardOn && isLow(h)) {
      after(() => alertLowRating(body.phone, h, { name: body.name, address: body.address }));
      return Response.json(
        { ok: false, blocked: "low_rating", rate: h.rate, phone: settings.phone, whatsapp: settings.whatsapp },
        { status: 403 },
      );
    }

    const product = products.find((p) => p.id === Number(body.productId));
    const area = deliveryOptions(settings).find((d) => d.id === body.area);
    if (!product || !area) {
      return Response.json({ ok: false, error: "পণ্য পাওয়া যায়নি, পেজ রিফ্রেশ করুন" }, { status: 400 });
    }

    // Dam server e hishab hoy, browser theke asha total bishshash kora hoy na
    const qty = Math.min(10, Math.max(1, Number(body.qty) || 1));
    const total = product.price * qty + deliveryCharge(settings, area, product, qty);
    const name = String(body.name).trim().slice(0, 100);
    // Facebook Conversions API er jonno (confirm er por Purchase e lage)
    const fbp = String(body.fbp || "").slice(0, 200);
    const fbc = String(body.fbc || "").slice(0, 300);
    const userAgent = String(req.headers.get("user-agent") || "").slice(0, 400);
    const pageUrl = String(body.pageUrl || "").slice(0, 400);
    const address = String(body.address).trim().slice(0, 500);

    const [row] = await sql`
      INSERT INTO orders (name, phone, address, product, area, qty, total, ip, fbp, fbc, user_agent, page_url)
      VALUES (${name}, ${body.phone}, ${address}, ${product.name}, ${area.id}, ${qty}, ${total}, ${ip},
              ${fbp}, ${fbc}, ${userAgent}, ${pageUrl})
      RETURNING id`;
    await sql`UPDATE products SET stock = GREATEST(stock - ${qty}, 0) WHERE id = ${product.id}`;
    await sql`DELETE FROM incomplete_orders WHERE phone = ${body.phone}`;
    revalidatePath("/admin", "layout");
    // Customer ke wait na koriye Telegram e pathay. BD Courier tokhon uttor na dile pore abar dekhi —
    // rating kom hole order nije theke বাতিল (kom rating er order kono bhabei chole na)
    after(async () => {
      if (guardOn && !h) {
        const h2 = await checkPhoneSafe(body.phone, { timeoutMs: 20000 });
        if (isLow(h2)) {
          await sql`UPDATE orders SET status = 'cancelled',
            note = ${`কম রেটিং (রিসিভ ${h2.rate}%) — নিজে থেকে বাতিল`} WHERE id = ${row.id}`;
          await sql`UPDATE products SET stock = stock + ${qty} WHERE id = ${product.id}`;
          revalidatePath("/admin", "layout");
          await alertLowRating(body.phone, h2, { name, address, stage: `অর্ডার #${row.id} নিজে থেকে বাতিল`, always: true });
          return;
        }
      }
      await notifyNewOrder(row.id);
      // Order holei Facebook e Purchase (shudhu FB/IG ad theke asha order, ekbar-i — kom rating e বাতিল hole jay na)
      await sendPurchase(row.id).catch((err) => console.error("FB purchase failed", err.message));
    });

    return Response.json({ ok: true, id: Number(row.id) });
  } catch (err) {
    console.error("Order save failed", err);
    return Response.json({ ok: false, error: "সার্ভারে সমস্যা, একটু পরে আবার চেষ্টা করুন" }, { status: 500 });
  }
}
