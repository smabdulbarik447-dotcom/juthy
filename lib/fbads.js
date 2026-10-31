import { sql } from "./db";
import { getSettings, saveSettings } from "./store";

// Facebook Marketing API — admin > অ্যাড theke campaign dekha, chalu/bondho, budget, auto niyom
const GRAPH = "https://graph.facebook.com/v24.0";

export const adAccountId = (s) => {
  const id = String(s.fb_ad_account || "").replace(/\D/g, "");
  return id ? `act_${id}` : "";
};
export const fbAdsReady = (s) => Boolean(s.fb_ads_token && adAccountId(s));

// Budget Facebook e "choto ekok" e (USD cent, BDT poisha) — ei currency gulo te dosomik nei
const NO_DECIMAL = ["JPY", "KRW", "VND", "CLP", "ISK", "PYG", "UGX", "HUF", "TWD", "COP", "IDR", "CRC"];
const offset = (cur) => (NO_DECIMAL.includes(cur) ? 1 : 100);

async function api(s, path, params = {}, method = "GET") {
  const qs = new URLSearchParams({ access_token: s.fb_ads_token });
  const opts = { method, cache: "no-store", signal: AbortSignal.timeout(20000) };
  if (method === "GET") for (const [k, v] of Object.entries(params)) qs.set(k, typeof v === "string" ? v : JSON.stringify(v));
  else opts.body = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  const res = await fetch(`${GRAPH}/${path}?${qs}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.error_user_msg || data.error?.message || `Facebook সমস্যা (${res.status})`);
  return data;
}

export async function getAccount(s) {
  const a = await api(s, adAccountId(s), { fields: "name,currency,account_status,amount_spent,balance,timezone_name" });
  return { ...a, active: a.account_status === 1 };
}

// Insights er "actions" theke purchase shonkha (Facebook ek-ek jaygay ek-ek nam dey)
const PURCHASE = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
function purchases(actions = []) {
  for (const t of PURCHASE) {
    const a = actions.find((x) => x.action_type === t);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}
const statRow = (r = {}) => ({
  spend: Number(r.spend) || 0,
  impressions: Number(r.impressions) || 0,
  clicks: Number(r.inline_link_clicks || r.clicks) || 0,
  ctr: Number(r.inline_link_click_ctr || r.ctr) || 0,
  purchases: purchases(r.actions),
});

export const PRESETS = [
  { id: "today", label: "আজ" },
  { id: "yesterday", label: "গতকাল" },
  { id: "last_7d", label: "৭ দিন" },
  { id: "last_30d", label: "৩০ দিন" },
  { id: "maximum", label: "সব সময়" },
];

/** Campaign + tar ad set (budget er jonno) + beche neya shomoyer hishab */
export async function getCampaigns(s, preset = "today") {
  const act = adAccountId(s);
  const [acc, camps, sets, ins] = await Promise.all([
    getAccount(s),
    api(s, `${act}/campaigns`, { fields: "id,name,status,effective_status,daily_budget,lifetime_budget,objective", limit: "200" }),
    api(s, `${act}/adsets`, { fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget", limit: "300" }),
    api(s, `${act}/insights`, {
      level: "campaign",
      date_preset: preset,
      fields: "campaign_id,spend,impressions,clicks,ctr,inline_link_clicks,inline_link_click_ctr,actions",
      limit: "200",
    }),
  ]);
  const off = offset(acc.currency);
  const money = (v) => (v ? Number(v) / off : null);
  const stats = Object.fromEntries((ins.data || []).map((r) => [r.campaign_id, statRow(r)]));
  const campaigns = (camps.data || [])
    .filter((c) => c.status !== "DELETED" && c.status !== "ARCHIVED")
    .map((c) => ({
      id: c.id,
      name: c.name,
      on: c.status === "ACTIVE",
      effective: c.effective_status,
      daily: money(c.daily_budget),
      lifetime: money(c.lifetime_budget),
      stats: stats[c.id] || statRow(),
      adsets: (sets.data || [])
        .filter((a) => a.campaign_id === c.id && a.status !== "DELETED" && a.status !== "ARCHIVED")
        .map((a) => ({ id: a.id, name: a.name, on: a.status === "ACTIVE", daily: money(a.daily_budget), lifetime: money(a.lifetime_budget) })),
    }))
    // Chalu gulo age, tarpor beshi khoroch
    .sort((a, b) => b.on - a.on || b.stats.spend - a.stats.spend);
  return { account: acc, campaigns };
}

export async function setAdStatus(s, id, on) {
  await api(s, id, { status: on ? "ACTIVE" : "PAUSED" }, "POST");
}

/** amount = account currency te (jemon $10) */
export async function setDailyBudget(s, id, amount) {
  const acc = await getAccount(s);
  await api(s, id, { daily_budget: Math.round(amount * offset(acc.currency)) }, "POST");
}

/** Amader order theke (link er utm_campaign = {{campaign.id}} / campaign nam) campaign onujayi order/delivered/return */
export async function ourCampaignOrders(preset, campaigns) {
  const days = { today: 0, yesterday: 1, last_7d: 7, last_30d: 30 }[preset];
  const rows = await sql`SELECT status, page_url, created_at FROM orders WHERE page_url LIKE '%utm_campaign=%'`;
  const dhakaDay = (t) => new Date(new Date(t).getTime() + 6 * 36e5).toISOString().slice(0, 10);
  const today = dhakaDay(Date.now());
  const from = days == null ? "" : dhakaDay(Date.now() - days * 864e5);
  const keyOf = Object.fromEntries(campaigns.flatMap((c) => [[c.id, c.id], [c.name.toLowerCase(), c.id]]));
  const out = {};
  for (const r of rows) {
    const d = dhakaDay(r.created_at);
    if (preset === "today" && d !== today) continue;
    if (preset === "yesterday" && d !== from) continue;
    if (from && preset !== "yesterday" && d < from) continue;
    let utm = "";
    try { utm = new URL(r.page_url).searchParams.get("utm_campaign") || ""; } catch {}
    const id = keyOf[utm] || keyOf[utm.toLowerCase()];
    if (!id) continue;
    const o = (out[id] ||= { orders: 0, delivered: 0, returned: 0, cancelled: 0 });
    o.orders++;
    if (o[r.status] != null) o[r.status]++;
  }
  return out;
}

/**
 * Auto niyom: aj kono chalu campaign e khoroch "সর্বনিম্ন খরচ" chhariye geche ar
 * protiti purchase er khoroch "সর্বোচ্চ খরচ" er beshi (ba ekta-o purchase nei) — campaign bondho + Telegram.
 * Shudhu BONDHO kore, kokhono chalu kore na ba budget barai na.
 */
export async function runAdRules({ force = false } = {}) {
  const s = await getSettings();
  if (!fbAdsReady(s) || s.ads_rule !== "on") return { paused: [] };
  const maxCpa = Number(s.ads_max_cpa) || 0;
  const minSpend = Number(s.ads_min_spend) || maxCpa;
  if (!maxCpa) return { paused: [] };
  // Admin panel khola thakle 30 minute e ekbar (cron/button e force)
  if (!force && Date.now() - (Number(s.ads_rule_last) || 0) < 30 * 60 * 1000) return { paused: [] };
  await saveSettings({ ads_rule_last: String(Date.now()) });

  const { account, campaigns } = await getCampaigns(s, "today");
  const paused = [];
  for (const c of campaigns.filter((x) => x.on)) {
    const { spend, purchases: p } = c.stats;
    const cpa = p ? spend / p : Infinity;
    if (spend >= minSpend && cpa > maxCpa) {
      try {
        await setAdStatus(s, c.id, false);
        paused.push({ name: c.name, spend, purchases: p });
      } catch (err) {
        console.error("Ad rule pause failed", c.id, err.message);
      }
    }
  }
  if (paused.length) {
    const { sendToAll } = await import("./telegram");
    const cur = account.currency;
    await sendToAll(
      [
        "⏸ <b>অ্যাড নিজে থেকে বন্ধ করা হয়েছে</b>",
        `নিয়ম: প্রতি অর্ডারে খরচ ${maxCpa} ${cur} এর বেশি`,
        "",
        ...paused.map((x) => `• ${esc(x.name)} — খরচ ${x.spend.toFixed(2)} ${cur}, অর্ডার ${x.purchases}`),
        "",
        "আবার চালু করতে: অ্যাডমিন → অ্যাড",
      ].join("\n"),
    );
  }
  return { paused };
}

const esc = (v) => String(v).replace(/[<>&]/g, "");

/** Protidin Telegram e ad er hishab (cron theke) */
export async function sendAdReport() {
  const s = await getSettings();
  if (!fbAdsReady(s) || s.ads_report !== "on") return;
  const { account, campaigns } = await getCampaigns(s, "today");
  const used = campaigns.filter((c) => c.stats.spend > 0);
  const cur = account.currency;
  const spend = used.reduce((t, c) => t + c.stats.spend, 0);
  const p = used.reduce((t, c) => t + c.stats.purchases, 0);
  const { sendToAll } = await import("./telegram");
  await sendToAll(
    [
      `📣 <b>আজকের অ্যাড রিপোর্ট</b> (এখন পর্যন্ত)`,
      `💸 খরচ: <b>${spend.toFixed(2)} ${cur}</b> • 🛒 অর্ডার: <b>${p}</b> • প্রতি অর্ডার: <b>${p ? (spend / p).toFixed(2) : "—"} ${cur}</b>`,
      "",
      ...(used.length
        ? used.map((c) => `${c.on ? "🟢" : "⏸"} ${esc(c.name)} — ${c.stats.spend.toFixed(2)} ${cur}, ${c.stats.purchases} অর্ডার${c.stats.purchases ? ` (${(c.stats.spend / c.stats.purchases).toFixed(2)}/অর্ডার)` : ""}`)
        : ["আজ কোনো অ্যাডে খরচ হয়নি"]),
    ].join("\n"),
  );
}
