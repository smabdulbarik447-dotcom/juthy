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

    // Ekadhik variant eksathe ashte pare; purono page theke ashle productId + qty
    const list = Array.isArray(body.items) ? body.items.slice(0, 20) : [{ productId: body.productId, qty: body.qty }];
    const items = list.map((it) => ({
      product: products.find((p) => p.id === Number(it.productId)),
      qty: Math.min(10, Math.max(1, Number(it.qty) || 1)),
    }));
    const area = deliveryOptions(settings).find((d) => d.id === body.area);
    if (!items.length || items.some((it) => !it.product) || !area) {
      return Response.json({ ok: false, error: "পণ্য পাওয়া যায়নি, পেজ রিফ্রেশ করুন" }, { status: 400 });
    }

    // Dam server e hishab hoy, browser theke asha total bishshash kora hoy na
    const qty = items.reduce((n, it) => n + it.qty, 0);
    // 1 tar beshi item nile (eki variant ba alada) delivery free
    const total = items.reduce((t, it) => t + it.product.price * it.qty, 0) + (qty > 1 ? 0 : area.charge);
    // Ekta variant hole shudhu nam; ekadhik hole "A × 1, B × 2"
    const productText =
      items.length === 1 ? items[0].product.name : items.map((it) => `${it.product.name} × ${it.qty}`).join(", ");
    const name = String(body.name).trim().slice(0, 100);
    const address = String(body.address).trim().slice(0, 500);

    const [row] = await sql`
      INSERT INTO orders (name, phone, address, product, area, qty, total, ip)
      VALUES (${name}, ${body.phone}, ${address}, ${productText.slice(0, 500)}, ${area.id}, ${qty}, ${total}, ${ip})
      RETURNING id`;
    for (const it of items) {
      await sql`UPDATE products SET stock = GREATEST(stock - ${it.qty}, 0) WHERE id = ${it.product.id}`;
    }
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
