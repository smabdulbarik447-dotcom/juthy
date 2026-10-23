import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql, ensureTables } from "@/lib/db";
import { getSettings, getProducts, deliveryOptions } from "@/lib/store";
import { checkOrder, clientIp } from "@/lib/fraud";
import { notifyNewOrder } from "@/lib/telegram";

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !/^01[3-9]\d{8}$/.test(body.phone || "") || !body.address) {
    return Response.json({ ok: false, error: "সব তথ্য সঠিকভাবে দিন" }, { status: 400 });
  }

  try {
    await ensureTables();
    const [settings, products] = await Promise.all([getSettings(), getProducts()]);
    const ip = clientIp(req);

    const problem = await checkOrder({
      phone: body.phone, ip, name: body.name, address: body.address, honeypot: body.website, settings,
    });
    if (problem?.silent) return Response.json({ ok: true, id: 0 });
    if (problem) return Response.json({ ok: false, error: problem.error }, { status: problem.status });

    const product = products.find((p) => p.id === Number(body.productId));
    const area = deliveryOptions(settings).find((d) => d.id === body.area);
    if (!product || !area) {
      return Response.json({ ok: false, error: "পণ্য পাওয়া যায়নি, পেজ রিফ্রেশ করুন" }, { status: 400 });
    }

    // Dam server e hishab hoy, browser theke asha total bishshash kora hoy na
    const qty = Math.min(10, Math.max(1, Number(body.qty) || 1));
    // 1 tar beshi nile delivery free
    const total = product.price * qty + (qty > 1 ? 0 : area.charge);
    const name = String(body.name).trim().slice(0, 100);
    const address = String(body.address).trim().slice(0, 500);

    const [row] = await sql`
      INSERT INTO orders (name, phone, address, product, area, qty, total, ip)
      VALUES (${name}, ${body.phone}, ${address}, ${product.name}, ${area.id}, ${qty}, ${total}, ${ip})
      RETURNING id`;
    await sql`UPDATE products SET stock = GREATEST(stock - ${qty}, 0) WHERE id = ${product.id}`;
    await sql`DELETE FROM incomplete_orders WHERE phone = ${body.phone}`;
    revalidatePath("/admin", "layout");
    // Customer ke wait na koriye Telegram e pathay
    after(() => notifyNewOrder(row.id));

    return Response.json({ ok: true, id: Number(row.id) });
  } catch (err) {
    console.error("Order save failed", err);
    return Response.json({ ok: false, error: "সার্ভারে সমস্যা, একটু পরে আবার চেষ্টা করুন" }, { status: 500 });
  }
}
