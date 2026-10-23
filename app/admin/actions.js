"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql, ensureTables, STATUSES, orderCode } from "@/lib/db";
import { saveSettings, getProducts, getSettings, deliveryOptions } from "@/lib/store";
import { checkPassword, login, logout, requireAdmin } from "@/lib/auth";
import { deleteImages } from "@/lib/images";
import { getBalance } from "@/lib/steadfast";
import { getPathaoStores } from "@/lib/pathao";
import { COURIERS, sendOrderToCourier, syncAllCouriers, autoSendOnConfirm, autoSendText } from "@/lib/courier";
import { notifyNewOrder, syncOrder, statusChangeText, markDeleted, sendToAll, removeChat, tg } from "@/lib/telegram";

const refreshAdmin = () => revalidatePath("/admin", "layout");
// Landing page o abar notun data diye toiri hobe
const refreshAll = () => revalidatePath("/", "layout");

export async function loginAction(_prev, formData) {
  if (!checkPassword(formData.get("password"))) {
    return { error: "পাসওয়ার্ড ভুল হয়েছে" };
  }
  await login();
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

/* ---------- Orders ---------- */

export async function updateStatus(id, status) {
  await requireAdmin();
  if (!STATUSES.some((s) => s.id === status)) return;
  await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
  // কনফার্ম korle nije theke courier e entry (বাতিল/onno status e kichu hoy na)
  const auto = status === "confirmed" ? await autoSendOnConfirm(id) : null;
  refreshAdmin();
  const change = [statusChangeText(status), autoSendText(auto)].filter(Boolean).join("\n");
  after(() => syncOrder(id, { change }));
  return auto;
}

export async function updateNote(id, note) {
  await requireAdmin();
  await sql`UPDATE orders SET note = ${String(note).slice(0, 500)} WHERE id = ${id}`;
  refreshAdmin();
  after(() => syncOrder(id));
}

export async function deleteOrder(id) {
  await requireAdmin();
  const [s] = await Promise.all([getSettings(), sql`DELETE FROM orders WHERE id = ${id}`]);
  refreshAdmin();
  after(() => markDeleted(id, orderCode(id, s.brand)));
}

/* ---------- Incomplete orders ---------- */

export async function deleteIncomplete(phone) {
  await requireAdmin();
  await sql`DELETE FROM incomplete_orders WHERE phone = ${phone}`;
  refreshAdmin();
}

// Call kore confirm korle ek click e অসম্পূর্ণ → আসল অর্ডার
export async function convertIncomplete(phone) {
  await requireAdmin();
  const [draft] = await sql`SELECT * FROM incomplete_orders WHERE phone = ${phone}`;
  if (!draft) return;
  const [products, settings] = await Promise.all([getProducts(), getSettings()]);
  const product = products.find((p) => p.name === draft.product) || products[0];
  const area = deliveryOptions(settings)[0];
  const [row] = await sql`
    INSERT INTO orders (name, phone, address, product, area, qty, total, status, note)
    VALUES (${draft.name || "—"}, ${draft.phone}, ${draft.address || "—"}, ${product?.name || draft.product},
            ${area.id}, 1, ${(product?.price || 0) + area.charge}, 'confirmed', 'অসম্পূর্ণ থেকে কনভার্ট')
    RETURNING id`;
  await sql`DELETE FROM incomplete_orders WHERE phone = ${phone}`;
  // Call kore confirm kora order — auto courier chalu thakle eta o chole jay
  const auto = await autoSendOnConfirm(row.id);
  refreshAdmin();
  after(() => notifyNewOrder(row.id));
  return auto;
}

/* ---------- Products ---------- */

export async function saveProduct(_prev, formData) {
  await requireAdmin();
  await ensureTables();
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") || "").trim().slice(0, 200);
  const price = Math.round(Number(formData.get("price")));
  const oldPrice = Math.round(Number(formData.get("old_price")) || 0);
  const stock = Math.round(Number(formData.get("stock")) || 0);
  const sort = Math.round(Number(formData.get("sort")) || 0);
  const image = String(formData.get("image") || "").trim();
  const active = formData.get("active") === "on";
  const freeDelivery = formData.get("free_delivery") === "on";

  if (!name || !(price > 0)) return { error: "নাম আর সঠিক দাম দিন" };

  if (id) {
    const [old] = await sql`SELECT image FROM products WHERE id = ${id}`;
    if (old && old.image !== image) await deleteImages([old.image]);
    await sql`
      UPDATE products SET name = ${name}, price = ${price}, old_price = ${oldPrice}, stock = ${stock},
        image = ${image}, sort = ${sort}, active = ${active}, free_delivery = ${freeDelivery}
      WHERE id = ${id}`;
  } else {
    await sql`
      INSERT INTO products (name, price, old_price, stock, image, sort, active, free_delivery)
      VALUES (${name}, ${price}, ${oldPrice}, ${stock}, ${image}, ${sort}, ${active}, ${freeDelivery})`;
  }
  refreshAll();
  redirect("/admin/products");
}

export async function deleteProduct(id) {
  await requireAdmin();
  const [old] = await sql`DELETE FROM products WHERE id = ${id} RETURNING image`;
  if (old) await deleteImages([old.image]);
  refreshAll();
}

/* ---------- Settings / Banner / Tracking ---------- */

export async function saveSettingsAction(_prev, formData) {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$")));
  // Banner theke je chobi soriye deya hoyeche, sheta storage theke o muche
  if ("gallery" in values) {
    const lines = (v) => String(v).split("\n").map((x) => x.trim()).filter(Boolean);
    const keep = new Set(lines(values.gallery));
    const before = lines((await getSettings()).gallery);
    await deleteImages(before.filter((u) => !keep.has(u)));
  }
  // Logo bodlale/muchle purono logo storage theke muche
  if ("logo" in values) {
    const old = (await getSettings()).logo;
    if (old !== values.logo) await deleteImages([old]);
  }
  if ("gtm_id" in values) values.gtm_id = String(values.gtm_id).trim().toUpperCase();
  await saveSettings(values);
  refreshAll();
  return { ok: true, at: Date.now() };
}

/* ---------- Fake order protection ---------- */

export async function blockValue(kind, value, reason = "") {
  await requireAdmin();
  if (!["phone", "ip"].includes(kind) || !String(value).trim()) return;
  await sql`
    INSERT INTO blocked (kind, value, reason) VALUES (${kind}, ${String(value).trim()}, ${String(reason).slice(0, 200)})
    ON CONFLICT (kind, value) DO UPDATE SET reason = EXCLUDED.reason`;
  refreshAdmin();
}

export async function unblock(kind, value) {
  await requireAdmin();
  await sql`DELETE FROM blocked WHERE kind = ${kind} AND value = ${value}`;
  refreshAdmin();
}

// Order theke ek click e: phone + IP block, order বাতিল
export async function blockOrder(id) {
  await requireAdmin();
  const [o] = await sql`SELECT phone, ip FROM orders WHERE id = ${id}`;
  if (!o) return;
  const reason = `ফেক অর্ডার #${id}`;
  await sql`INSERT INTO blocked (kind, value, reason) VALUES ('phone', ${o.phone}, ${reason}) ON CONFLICT DO NOTHING`;
  if (o.ip) await sql`INSERT INTO blocked (kind, value, reason) VALUES ('ip', ${o.ip}, ${reason}) ON CONFLICT DO NOTHING`;
  await sql`UPDATE orders SET status = 'cancelled' WHERE id = ${id}`;
  refreshAdmin();
  after(() => syncOrder(id, { change: "🚫 <b>ফেক — ব্লক ও বাতিল</b>" }));
}

export async function addBlockAction(_prev, formData) {
  await requireAdmin();
  const value = String(formData.get("value") || "").trim();
  const kind = /^01[3-9]\d{8}$/.test(value) ? "phone" : /^[\d.:a-fA-F]{3,64}$/.test(value) ? "ip" : null;
  if (!kind) return { error: "সঠিক মোবাইল নাম্বার (01XXXXXXXXX) বা IP দিন" };
  await blockValue(kind, value, formData.get("reason") || "");
  return { ok: true, at: Date.now() };
}

/* ---------- Telegram ---------- */

const TG_COMMANDS = [
  { command: "orders", description: "সর্বশেষ ১০টি অর্ডার (বাটনসহ)" },
  { command: "pending", description: "পেন্ডিং অর্ডার — কনফার্ম করতে" },
  { command: "confirmed", description: "কনফার্মড অর্ডার — শিপ করতে" },
  { command: "shipped", description: "শিপড অর্ডার — ডেলিভারি আপডেট" },
  { command: "order", description: "নির্দিষ্ট অর্ডার: /order VE000012 বা মোবাইল" },
  { command: "today", description: "আজকের হিসাব" },
  { command: "stats", description: "সব মিলিয়ে হিসাব" },
  { command: "stop", description: "নোটিফিকেশন বন্ধ" },
];

// Telegram ke bole dey kothay update pathabe (amader /api/telegram e, gopon secret shoho)
export async function setupTelegramWebhook(_prev, formData) {
  await requireAdmin();
  const base = String(formData.get("base") || "").replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) return { error: "লাইভ সাইটের https লিংক লাগবে" };
  const res = await tg("setWebhook", {
    url: `${base}/api/telegram`,
    secret_token: process.env.TELEGRAM_SECRET,
    allowed_updates: ["message", "callback_query"],
  });
  await tg("setMyCommands", {
    commands: TG_COMMANDS,
  });
  if (!res?.ok) return { error: res?.description || "Telegram এ কানেক্ট হয়নি" };
  refreshAdmin();
  return { ok: true, at: Date.now() };
}

export async function sendTestMessage() {
  await requireAdmin();
  await sendToAll("✅ <b>টেস্ট মেসেজ</b> — Telegram নোটিফিকেশন ঠিকমতো কাজ করছে!");
}

export async function disconnectChat(chatId) {
  await requireAdmin();
  await tg("sendMessage", { chat_id: chatId, text: "🔕 অ্যাডমিন প্যানেল থেকে এই চ্যাট ডিসকানেক্ট করা হয়েছে।" });
  await removeChat(chatId);
  refreshAdmin();
}

/* ---------- Courier (Steadfast / Pathao) ---------- */

const sentText = (courier, tracking) =>
  `${COURIERS[courier].icon} <b>${COURIERS[courier].name} এ পাঠানো হয়েছে</b> — ট্র্যাকিং ${tracking}`;

export async function sendToCourier(id, courier) {
  await requireAdmin();
  try {
    const { tracking } = await sendOrderToCourier(id, courier);
    refreshAdmin();
    after(() => syncOrder(id, { change: sentText(courier, tracking) }));
    return { ok: true, tracking };
  } catch (err) {
    return { error: err.message };
  }
}

// Shob কনফার্মড (ekhono na pathano) order ekshathe beche neya courier e
export async function sendConfirmedToCourier(courier) {
  await requireAdmin();
  const rows = await sql`
    SELECT id FROM orders WHERE status = 'confirmed' AND courier_id = '' ORDER BY created_at LIMIT 50`;
  let sent = 0;
  const errors = [];
  for (const r of rows) {
    try {
      const { tracking } = await sendOrderToCourier(r.id, courier);
      sent++;
      after(() => syncOrder(r.id, { change: sentText(courier, tracking) }));
    } catch (err) {
      errors.push(`#${r.id}: ${err.message}`);
    }
  }
  refreshAdmin();
  return { sent, total: rows.length, errors };
}

export async function syncCouriersAction() {
  await requireAdmin();
  const res = await syncAllCouriers();
  refreshAdmin();
  for (const c of res.changed) after(() => syncOrder(c.id, { change: statusChangeText(c.status) + " (কুরিয়ার)" }));
  return res;
}

export async function saveDefaultCourier(_prev, formData) {
  await requireAdmin();
  const c = formData.get("default_courier");
  if (COURIERS[c]) await saveSettings({ default_courier: c });
  const auto = formData.get("auto_courier");
  if (auto === "on" || auto === "off") await saveSettings({ auto_courier: auto });
  refreshAdmin();
  return { ok: true, at: Date.now() };
}

export async function savePathaoAction(_prev, formData) {
  await requireAdmin();
  const get = (k) => String(formData.get(k) || "").trim();
  const values = { pathao_client_id: get("pathao_client_id"), pathao_username: get("pathao_username") };
  // Secret/password khali rakhle purono ta i thake
  if (get("pathao_client_secret")) values.pathao_client_secret = get("pathao_client_secret");
  if (get("pathao_password")) values.pathao_password = get("pathao_password");
  if (get("pathao_store_id")) values.pathao_store_id = get("pathao_store_id");
  // Notun tottho: ager "ভুল" chihno ar purono token muche abar login kori
  Object.assign(values, { pathao_key_status: "", pathao_token: "", pathao_token_exp: "" });
  await saveSettings(values);
  refreshAdmin();
  try {
    const s = await getSettings();
    const stores = await getPathaoStores(s);
    if (!stores.length) return { error: "লগইন হয়েছে, কিন্তু Pathao তে কোনো স্টোর নেই — Pathao প্যানেলে আগে একটা স্টোর বানান" };
    // Store beche na dile (ba ager ta na thakle) prothom ta nei
    const store = stores.find((x) => x.id === s.pathao_store_id) || stores[0];
    await saveSettings({ pathao_store_id: store.id, pathao_store_name: store.name, pathao_key_status: "ok" });
    refreshAdmin();
    return { ok: true, at: Date.now() };
  } catch (err) {
    return { error: `সেভ হয়েছে, কিন্তু Pathao কানেক্ট হয়নি: ${err.message}` };
  }
}

export async function saveCourierAction(_prev, formData) {
  await requireAdmin();
  const values = { steadfast_api_key: String(formData.get("steadfast_api_key") || "").trim() };
  // Secret khali rakhle purono ta i thake
  const secret = String(formData.get("steadfast_secret_key") || "").trim();
  if (secret) values.steadfast_secret_key = secret;
  // Notun key: ager "ভুল" chihno muche abar ekbar check kori
  values.steadfast_key_status = "";
  await saveSettings(values);
  refreshAdmin();
  try {
    const balance = await getBalance(await getSettings());
    await saveSettings({ steadfast_key_status: "ok" });
    return { ok: true, at: Date.now(), balance };
  } catch (err) {
    return { error: `সেভ হয়েছে, কিন্তু Steadfast কানেক্ট হয়নি: ${err.message}` };
  }
}
