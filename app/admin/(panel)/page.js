import Link from "next/link";
import { sql, ensureTables, STATUSES, orderCode } from "@/lib/db";
import { getProducts, getSettings, orderDelivery } from "@/lib/store";
import { dhakaDay, money, resolveRange, inRange } from "@/lib/dateRange";
import RangeFilter from "./RangeFilter";
import Icon from "./Icon";
import RecentLimit from "./RecentLimit";
import CountUp from "./CountUp";
import LiveClock from "./LiveClock";
import OrderCalendar from "./OrderCalendar";
import { LIMITS } from "@/lib/dateRange";
import { districtOf } from "@/lib/districts";
import { QuickBar, ReorderList } from "./QuickTools";
import Celebrate from "./Celebrate";
import { orderSource } from "@/lib/orderSource";
import { courierName, courierIcon } from "@/lib/courier";

const STATUS_COLOR = {
  pending: "#3b82f6", confirmed: "#16a34a", shipped: "#a855f7",
  delivered: "#14b8a6", returned: "#f97316", cancelled: "#ef4444",
};
const DAY = 864e5;
const fmtDate = (d) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });

export default async function Dashboard({ searchParams }) {
  const sp = await searchParams;
  const rangeId = sp.range || "30d";
  const range = resolveRange(rangeId, sp.from, sp.to);
  // Saamprotik order koyta dekhabe (10/20/50/100/500)
  const show = LIMITS.includes(Number(sp.show)) ? Number(sp.show) : 20;
  await ensureTables();
  const [orders, products, settings, incomplete] = await Promise.all([
    sql`SELECT id, created_at, name, phone, address, product, area, qty, total, status, delivery_fee, courier_id, courier, page_url, fbc, user_agent FROM orders ORDER BY created_at DESC`,
    getProducts({ all: true }),
    getSettings(),
    sql`SELECT phone, name, product, updated_at FROM incomplete_orders ORDER BY updated_at DESC LIMIT 5`,
  ]);
  const [incAll, [shield]] = await Promise.all([
    sql`SELECT updated_at FROM incomplete_orders`,
    sql`SELECT
      (SELECT count(*)::int FROM phone_history WHERE alerted_at > now() - interval '30 days') AS blocked,
      (SELECT count(*)::int FROM orders WHERE note LIKE 'কম রেটিং%' AND created_at > now() - interval '30 days') AS auto_cancel`,
  ]);

  const inR = orders.filter((o) => inRange(o.created_at, range));
  const sum = (list) => list.reduce((t, o) => t + o.total, 0);
  const isSale = (o) => ["confirmed", "shipped", "delivered"].includes(o.status);
  const customers = (list) => new Set(list.map((o) => o.phone)).size;

  // Ager shoman shomoy er sathe tulona (jemon ৩০ দিন → tar ager ৩০ দিন)
  let prev = null;
  if (range.from) {
    const len = Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY) + 1;
    const pTo = dhakaDay(Date.parse(range.from) - DAY);
    const pFrom = dhakaDay(Date.parse(range.from) - len * DAY);
    prev = orders.filter((o) => inRange(o.created_at, { from: pFrom, to: pTo }));
  }
  const trend = (now, before) => {
    if (prev === null) return null;
    if (!before) return now ? 100 : 0;
    return Math.round(((now - before) / before) * 100);
  };

  const sales = inR.filter(isSale);
  const cards = [
    { icon: "cart", color: "green", label: "মোট অর্ডার", value: inR.length, t: trend(inR.length, prev?.length) },
    { icon: "users", color: "orange", label: "মোট কাস্টমার", value: customers(inR), t: trend(customers(inR), prev && customers(prev)) },
    { icon: "box", color: "purple", label: "কনফার্মড অর্ডার", value: sales.length, t: trend(sales.length, prev?.filter(isSale).length) },
    { icon: "wave", color: "red", label: "মোট বিক্রি (কনফার্মড)", value: money(sum(sales)), t: trend(sum(sales), prev && sum(prev.filter(isSale))) },
  ];
  // Order page er moto: nit profit (shudhu ডেলিভারড, delivery charge bade), batil ar return er taka
  const ofStatus = (list, st) => list.filter((o) => o.status === st);
  const net = (list) => ofStatus(list, "delivered").reduce((t, o) => t + o.total - orderDelivery(settings, products, o), 0);
  cards.push(
    { icon: "chart", color: "lime", label: `নিট প্রফিট (${ofStatus(inR, "delivered").length}টি ডেলিভারড)`, value: money(net(inR)), t: trend(net(inR), prev && net(prev)) },
    { icon: "arrow", color: "rose", label: "বাতিল", value: `${ofStatus(inR, "cancelled").length}টি • ${money(sum(ofStatus(inR, "cancelled")))}`, t: null },
    { icon: "cart", color: "sky", label: "পেন্ডিং (কলের অপেক্ষায়)", value: `${ofStatus(inR, "pending").length}টি • ${money(sum(ofStatus(inR, "pending")))}`, t: null },
    { icon: "box", color: "amber", label: "রিটার্ন", value: `${ofStatus(inR, "returned").length}টি • ${money(sum(ofStatus(inR, "returned")))}`, t: null },
  );

  // Sales Overview: chhoto range e din-protidin, boro/সব সময় e mash-protimash
  let buckets;
  const spanDays = range.from ? Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY) + 1 : 9999;
  // Din-protidin: shesh tarikh theke pichoner ১৫ din (porishkar bojhar jonno shorbochcho ১৫ ta bar)
  const CHART_DAYS = 15;
  if (spanDays <= 31) {
    const end = Date.parse(range.to || dhakaDay(Date.now()));
    buckets = Array.from({ length: CHART_DAYS }, (_, i) => {
      const key = dhakaDay(end - (CHART_DAYS - 1 - i) * DAY);
      const d = new Date(key);
      const list = orders.filter((o) => dhakaDay(o.created_at) === key);
      return {
        key,
        label: String(d.getUTCDate()),
        // Prothom bar ar mash er ১ tarikh e mash er nam
        sub: i === 0 || d.getUTCDate() === 1 ? d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) : "",
        full: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
        list,
      };
    });
  } else {
    const now = new Date(dhakaDay(Date.now()));
    buckets = Array.from({ length: 9 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (8 - i), 1));
      const key = d.toISOString().slice(0, 7);
      const list = orders.filter((o) => dhakaDay(o.created_at).startsWith(key));
      return { key, label: d.toLocaleDateString("en-GB", { month: "short" }), sub: "", full: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), list };
    });
  }
  buckets = buckets.map((b) => ({ ...b, sales: sum(b.list.filter(isSale)), count: b.list.length }));
  const maxSales = Math.max(1, ...buckets.map((b) => b.sales));
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  // Order Status donut
  const statusRows = STATUSES.map((s) => ({ ...s, n: inR.filter((o) => o.status === s.id).length, color: STATUS_COLOR[s.id] }));
  let acc = 0;
  const donut = inR.length
    ? `conic-gradient(${statusRows
        .filter((r) => r.n)
        .map((r) => {
          const start = acc;
          acc += (r.n / inR.length) * 100;
          return `${r.color} ${start}% ${acc}%`;
        })
        .join(", ")})`
    : "conic-gradient(#e5e7eb 0 100%)";
  // Ring er protiti rong er majhkhane tar % (khub choto bhag e jayga nei, tai 5% er kom hole lekha hoy na)
  let at = 0;
  const donutLabels = inR.length
    ? statusRows.filter((r) => r.n).map((r) => {
        const pct = (r.n / inR.length) * 100;
        const mid = ((at + pct / 2) / 100) * 2 * Math.PI;
        at += pct;
        return { id: r.id, pct: Math.round(pct), x: 50 + 41.5 * Math.sin(mid), y: 50 - 41.5 * Math.cos(mid) };
      }).filter((l) => l.pct >= 5)
    : [];

  // Top products (beche neya shomoy e কনফার্মড)
  const topMap = {};
  for (const o of sales) topMap[o.product] = (topMap[o.product] || 0) + o.qty;
  const top = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const stockOf = (name) => products.find((p) => p.name === name);
  const label = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));
  // Welcome banner: shomoy onujayi shubhechha, ar confirm/delivery er har
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }));
  const greet = hour < 12 ? "শুভ সকাল" : hour < 17 ? "শুভ দুপুর" : hour < 20 ? "শুভ সন্ধ্যা" : "শুভ রাত্রি";
  const cancelled = inR.filter((o) => o.status === "cancelled").length;
  const confirmRate = sales.length + cancelled ? Math.round((sales.length / (sales.length + cancelled)) * 100) : null;
  const delivered = inR.filter((o) => o.status === "delivered").length;
  const returned = inR.filter((o) => o.status === "returned").length;
  const successRate = delivered + returned ? Math.round((delivered / (delivered + returned)) * 100) : null;
  const pendingNow = orders.filter((o) => o.status === "pending").length;

  // Ajker pulse: aj vs gotokal, ghonta-ghonta order, shesh order kokhon, ajker shera perfume
  const today = dhakaDay(Date.now());
  const yday = dhakaDay(Date.now() - DAY);
  const todayList = orders.filter((o) => dhakaDay(new Date(o.created_at).getTime()) === today);
  const ydayList = orders.filter((o) => dhakaDay(new Date(o.created_at).getTime()) === yday);
  const hourOf = (d) => Number(new Date(d).toLocaleString("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false })) % 24;
  const hourly = Array.from({ length: 24 }, (_, h) => todayList.filter((o) => hourOf(o.created_at) === h).length);
  const maxHour = Math.max(1, ...hourly);
  const agoOf = (d) => {
    const min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 6e4));
    return min < 60 ? `${min} মিনিট আগে` : min < 1440 ? `${Math.round(min / 60)} ঘণ্টা আগে` : `${Math.round(min / 1440)} দিন আগে`;
  };
  const ago = orders[0] ? agoOf(orders[0].created_at) : "—";

  // Calendar: protidin koyta order ar koto confirm bikri
  const calDays = {};
  for (const o of orders) {
    const k = dhakaDay(o.created_at);
    const d = (calDays[k] ||= { n: 0, s: 0 });
    d.n += 1;
    if (isSale(o)) d.s += o.total;
  }

  // Masher lokkho: ei mash er confirm bikri vs goto mash er puro bikri
  const monthKey = today.slice(0, 7);
  const lastMonthKey = dhakaDay(new Date(monthKey + "-01T00:00:00Z").getTime() - DAY).slice(0, 7);
  const monthSales = sum(orders.filter((o) => isSale(o) && dhakaDay(o.created_at).startsWith(monthKey)));
  const lastMonthSales = sum(orders.filter((o) => isSale(o) && dhakaDay(o.created_at).startsWith(lastMonthKey)));
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const projected = Math.round((monthSales / dayOfMonth) * daysInMonth);
  const goalPct = lastMonthSales ? Math.round((monthSales / lastMonthSales) * 100) : monthSales ? 100 : 0;
  const todayTop = Object.entries(todayList.reduce((m, o) => ({ ...m, [o.product]: (m[o.product] || 0) + o.qty }), {})).sort((a, b) => b[1] - a[1])[0];
  const diff = todayList.length - ydayList.length;

  // জেলা লিডারবোর্ড: kon jela theke beshi order ar kothay return beshi (beche neya shomoy)
  const distMap = {};
  for (const o of inR) {
    const d = districtOf(o.address, o.area) || "অজানা";
    const r = (distMap[d] ||= { n: 0, ok: 0, bad: 0, s: 0 });
    r.n += 1;
    if (o.status === "delivered") r.ok += 1;
    if (o.status === "returned") r.bad += 1;
    if (isSale(o)) r.s += o.total;
  }
  const districts = Object.entries(distMap).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const maxDist = Math.max(1, ...districts.map(([, r]) => r.n));

  // Kokhon order beshi ashe: shopter din × 4 ghontar khondo (shob order) — ad chalanor shera shomoy
  const WEEK = ["শনি", "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র"];
  const WEEK_FULL = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"];
  const SLOTS = ["রাত ১২–৪", "ভোর ৪–৮", "সকাল ৮–১২", "দুপুর ১২–৪", "বিকেল ৪–৮", "রাত ৮–১২"];
  const grid = WEEK.map(() => SLOTS.map(() => 0));
  for (const o of orders) {
    const t = new Date(new Date(o.created_at).getTime() + 6 * 36e5); // Dhaka = UTC+6
    grid[(t.getUTCDay() + 1) % 7][Math.floor(t.getUTCHours() / 4)] += 1;
  }
  const maxCell = Math.max(1, ...grid.flat());
  let bestCell = null;
  grid.forEach((row, d) => row.forEach((n, s) => { if (n && (!bestCell || n > bestCell.n)) bestCell = { d, s, n }; }));
  const dayTotals = grid.map((row) => row.reduce((a, b) => a + b, 0));
  const bestDay = dayTotals.indexOf(Math.max(...dayTotals));

  // Loyal customer: ek number theke ekadhik order, ar delivered taka onujayi shera 5 jon
  const byPhone = {};
  for (const o of orders) {
    const c = (byPhone[o.phone] ||= { name: o.name, n: 0, ok: 0, spent: 0 });
    c.n += 1;
    if (o.status === "delivered") { c.ok += 1; c.spent += o.total; }
  }
  const allCust = Object.values(byPhone);
  const repeat = allCust.filter((c) => c.n > 1).length;
  const repeatRate = allCust.length ? Math.round((repeat / allCust.length) * 100) : 0;
  const loyal = Object.entries(byPhone).filter(([, c]) => c.ok > 0).sort((a, b) => b[1].spent - a[1].spent || b[1].n - a[1].n).slice(0, 5);
  const avgOrder = sales.length ? Math.round(sum(sales) / sales.length) : 0;

  // Sales funnel (beche neya shomoy): form shuru → order → confirm → courier → delivered
  const shippedUp = inR.filter((o) => ["shipped", "delivered", "returned"].includes(o.status)).length;
  const funnel = [
    { label: "ফর্ম পূরণ শুরু", n: inR.length + incAll.filter((r) => inRange(r.updated_at, range)).length, c: "#6366f1" },
    { label: "অর্ডার করেছে", n: inR.length, c: "#8b5cf6" },
    { label: "কনফার্ম হয়েছে", n: inR.filter((o) => ["confirmed", "shipped", "delivered", "returned"].includes(o.status)).length, c: "#ec4899" },
    { label: "কুরিয়ারে গেছে", n: shippedUp, c: "#f97316" },
    { label: "ডেলিভারড", n: ofStatus(inR, "delivered").length, c: "#16a34a" },
  ];
  const funnelTop = Math.max(1, funnel[0].n);

  // Taka kothay ache (shob shomoy): hate pawa, courier e pothe, pathano baki, call baki
  const flow = [
    { label: "ডেলিভারড (হাতে আসবে/এসেছে)", v: sum(ofStatus(orders, "delivered")), c: "#16a34a" },
    { label: "কুরিয়ারে পথে", v: sum(ofStatus(orders, "shipped")), c: "#a855f7" },
    { label: "কনফার্মড, পাঠানো বাকি", v: sum(ofStatus(orders, "confirmed")), c: "#0ea5e9" },
    { label: "কলের অপেক্ষায়", v: sum(ofStatus(orders, "pending")), c: "#f59e0b" },
  ];
  const flowTotal = Math.max(1, flow.reduce((t, f) => t + f.v, 0));
  const returnLoss = ofStatus(orders, "returned").reduce((t, o) => t + orderDelivery(settings, products, o), 0);

  // Record: shobcheye beshi order er din, ar tana koy din dhore order ashche (streak)
  let record = null;
  for (const [k, d] of Object.entries(calDays)) if (!record || d.n > record.n) record = { day: k, ...d };
  let streak = 0;
  for (let t = calDays[today] ? Date.now() : Date.now() - DAY; calDays[dhakaDay(t)]; t -= DAY) streak++;
  const toRecord = record ? Math.max(0, record.n - todayList.length + 1) : 0;

  const qs = rangeId === "custom" ? `range=custom&from=${sp.from}&to=${sp.to}` : `range=${rangeId}`;

  // অর্ডার কোথা থেকে আসছে (beche neya shomoy): link er utm/fbclid, call e newa order alada
  const sourceOf = (o) => orderSource(o).id;
  const SOURCES = {
    fb: { label: "Facebook অ্যাড/পেজ", icon: "📘", c: "#1877f2" },
    ig: { label: "Instagram", icon: "📸", c: "#e1306c" },
    tiktok: { label: "TikTok", icon: "🎵", c: "#111827" },
    google: { label: "Google", icon: "🔎", c: "#16a34a" },
    msg: { label: "Messenger", icon: "💬", c: "#0ea5e9" },
    an: { label: "অন্য অ্যাপ", icon: "📱", c: "#64748b" },
    direct: { label: "সরাসরি / অন্যান্য", icon: "🌐", c: "#8b5cf6" },
    call: { label: "কল / হাতে বসানো", icon: "📞", c: "#f59e0b" },
  };
  const srcMap = {};
  for (const o of inR) {
    const r = (srcMap[sourceOf(o)] ||= { n: 0, sale: 0, cancel: 0, ok: 0, bad: 0 });
    r.n += 1;
    if (isSale(o)) r.sale += 1;
    if (o.status === "cancelled") r.cancel += 1;
    if (o.status === "delivered") r.ok += 1;
    if (o.status === "returned") r.bad += 1;
  }
  const sources = Object.entries(srcMap).sort((a, b) => b[1].n - a[1].n);
  const maxSrc = Math.max(1, ...sources.map(([, r]) => r.n));

  // কুরিয়ার তুলনা (beche neya shomoy): kon courier e pathano parcel beshi ডেলিভারড hoy
  const curMap = {};
  for (const o of inR) {
    if (!o.courier_id) continue;
    const r = (curMap[courierName(o)] ||= { icon: courierIcon(o), n: 0, ok: 0, bad: 0, way: 0 });
    r.n += 1;
    if (o.status === "delivered") r.ok += 1;
    else if (o.status === "returned") r.bad += 1;
    else if (o.status === "shipped") r.way += 1;
  }
  const couriersCmp = Object.entries(curMap)
    .map(([name, r]) => ({ name, ...r, rate: r.ok + r.bad ? Math.round((r.ok / (r.ok + r.bad)) * 100) : null }))
    .sort((a, b) => b.n - a.n);
  const bestCourier = couriersCmp.filter((c) => c.rate !== null && c.ok + c.bad >= 5).sort((a, b) => b.rate - a.rate)[0];

  // আবার কেনার সময়: shesh ডেলিভারড order 20–60 din age, tarpor ar order nei — WhatsApp e mone koriye dewa
  const lastBy = {};
  for (const o of orders) if (!lastBy[o.phone]) lastBy[o.phone] = o; // orders notun theke purono
  const reorder = Object.values(lastBy)
    .filter((o) => o.status === "delivered")
    .map((o) => ({ o, days: Math.floor((Date.now() - new Date(o.created_at).getTime()) / DAY) }))
    .filter((x) => x.days >= 20 && x.days <= 60)
    .sort((a, b) => a.days - b.days)
    .map(({ o, days }) => ({
      phone: o.phone,
      name: o.name,
      product: o.product,
      days,
      wa: `https://wa.me/88${o.phone}?text=${encodeURIComponent(`হাই ${o.name}! ${settings.brand} থেকে বলছি 😊 আপনার ${o.product} কেমন লাগলো? পারফিউম শেষ হয়ে এলে এই মেসেজের রিপ্লাই দিন — আবার দ্রুত পৌঁছে দেবো ❤️`)}`,
    }));

  // লেভেল ও অর্জন (game er moto): ডেলিভারড order = XP, ar milestone purno hole badge khole
  const deliveredAll = ofStatus(orders, "delivered");
  const returnedAll = ofStatus(orders, "returned").length;
  const xp = deliveredAll.length;
  const LEVELS = [
    [0, "নতুন সেলার", "🌱"], [10, "উঠতি সেলার", "🌿"], [25, "ব্রোঞ্জ সেলার", "🥉"], [50, "সিলভার সেলার", "🥈"],
    [100, "গোল্ড সেলার", "🥇"], [250, "প্লাটিনাম সেলার", "💠"], [500, "ডায়মন্ড সেলার", "💎"], [1000, "মাস্টার সেলার", "👑"],
    [2500, "লিজেন্ড সেলার", "🐐"], [5000, "পারফিউম কিং", "🦁"],
  ];
  const lvlIdx = LEVELS.findLastIndex(([min]) => xp >= min);
  const [lvlMin, lvlName, lvlIcon] = LEVELS[lvlIdx];
  const nextLvl = LEVELS[lvlIdx + 1];
  const lvlPct = nextLvl ? Math.round(((xp - lvlMin) / (nextLvl[0] - lvlMin)) * 100) : 100;
  // Shobcheye lomba tana order er din
  let bestStreak = 0;
  let run = 0;
  let prevDay = null;
  for (const d of Object.keys(calDays).sort()) {
    run = prevDay && Date.parse(d) - Date.parse(prevDay) === DAY ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prevDay = d;
  }
  const soldAll = sum(deliveredAll);
  const deliveredDistricts = new Set(deliveredAll.map((o) => districtOf(o.address, o.area)).filter(Boolean)).size;
  const rateAll = xp + returnedAll ? Math.round((xp / (xp + returnedAll)) * 100) : 0;
  const BADGES = [
    { icon: "🎉", name: "প্রথম অর্ডার", have: orders.length, need: 1 },
    { icon: "📦", name: "প্রথম ডেলিভারি", have: xp, need: 1 },
    { icon: "💯", name: "১০০ অর্ডার", have: orders.length, need: 100 },
    { icon: "🏅", name: "১০০ ডেলিভারি", have: xp, need: 100 },
    { icon: "🚀", name: "৫০০ অর্ডার", have: orders.length, need: 500 },
    { icon: "💰", name: "১ লাখ টাকা বিক্রি", have: soldAll, need: 100000, money: true },
    { icon: "💎", name: "১০ লাখ টাকা বিক্রি", have: soldAll, need: 1000000, money: true },
    { icon: "🔥", name: "৭ দিন টানা অর্ডার", have: bestStreak, need: 7 },
    { icon: "⚡", name: "একদিনে ২০ অর্ডার", have: record?.n || 0, need: 20 },
    { icon: "🗺️", name: "২০ জেলায় ডেলিভারি", have: deliveredDistricts, need: 20 },
    { icon: "🔁", name: "১০ জন ফেরত কাস্টমার", have: repeat, need: 10 },
    { icon: "🎯", name: "৯০% সাকসেস (৫০+ পার্সেল)", have: xp + returnedAll >= 50 ? rateAll : 0, need: 90, pct: true },
  ].map((b) => ({ ...b, done: b.have >= b.need, pctDone: Math.min(100, Math.round((b.have / b.need) * 100)) }));
  const badgesDone = BADGES.filter((b) => b.done).length;
  // Protidin notun ekta utsaho er kotha
  const QUOTES = [
    "প্রতিটা অর্ডার একটা নতুন বিশ্বাস — যত্ন করে পাঠান 💜",
    "আজকের ছোট কাজই কালকের বড় ব্র্যান্ড 🚀",
    "কাস্টমার খুশি = আবার অর্ডার = আরও বিক্রি 🔁",
    "রিটার্ন কমান, লাভ বাড়ান — কল করে কনফার্ম করুন 📞",
    "সুগন্ধ মানুষ মনে রাখে, ভালো সার্ভিসও 🌸",
    "ধৈর্য আর লেগে থাকা — এটাই আসল সিক্রেট 🔑",
    "প্রতিদিন একটু একটু করে এগোলেই রেকর্ড ভাঙে 🏆",
  ];
  const quote = QUOTES[Math.floor(Date.parse(today) / DAY) % QUOTES.length];

  return (
    <>
      <section className="dash-hero">
        <div className="dash-hero-text">
          <span className="dash-greet">{greet} 👋</span>
          <h1>স্বাগতম, {settings.brand}!</h1>
          <p>
            📅 {range.label} — {inR.length}টি অর্ডার
            {pendingNow > 0 ? <> • <Link href="/admin/orders?status=pending" className="hero-pending">{pendingNow}টি অর্ডার কলের অপেক্ষায়</Link></> : " • সব অর্ডার দেখা হয়েছে ✅"}
          </p>
        </div>
        <LiveClock />
        <span className="mist" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>
        <div className="dash-hero-stats">
          <div className="dash-big">
            <small>কনফার্মড বিক্রি</small>
            <b><CountUp value={money(sum(sales))} /></b>
          </div>
          <div className="dash-ring" style={{ "--p": confirmRate ?? 0 }}>
            <b>{confirmRate === null ? "—" : `${confirmRate}%`}</b>
            <small>কনফার্ম রেট</small>
          </div>
          <div className="dash-ring green" style={{ "--p": successRate ?? 0 }}>
            <b>{successRate === null ? "—" : `${successRate}%`}</b>
            <small>ডেলিভারি সফল</small>
          </div>
        </div>
      </section>

      <section className="pulse">
        <div className="pulse-title"><span className="pulse-dot" /> আজকের পালস</div>
        <div className="pulse-item">
          <small>আজ অর্ডার</small>
          <b>{todayList.length}টি</b>
          <em className={diff >= 0 ? "up" : "down"}>{diff >= 0 ? "▲" : "▼"} {Math.abs(diff)} গতকালের চেয়ে</em>
        </div>
        <div className="pulse-item">
          <small>আজ বিক্রি</small>
          <b>{money(sum(todayList.filter(isSale)))}</b>
          <em>মোট {money(sum(todayList))}</em>
        </div>
        <div className="pulse-item">
          <small>শেষ অর্ডার</small>
          <b>{ago}</b>
          <em>{orders[0]?.name || ""}</em>
        </div>
        <div className="pulse-item">
          <small>আজকের সেরা</small>
          <b className="pulse-top">{todayTop ? todayTop[0] : "—"}</b>
          <em>{todayTop ? `${todayTop[1]}টি বিক্রি` : "এখনো অর্ডার নেই"}</em>
        </div>
        <div className="pulse-hours" title="আজ ঘণ্টা অনুযায়ী অর্ডার">
          {hourly.map((n, h) => (
            <span key={h} className={n ? "has" : ""} style={{ height: `${12 + (n / maxHour) * 88}%` }} title={`${h}:00 — ${n}টি`} />
          ))}
          <small>১২AM</small><small>১২PM</small><small>১১PM</small>
        </div>
      </section>

      <QuickBar />

      {record && record.day === today && todayList.length > 0 ? (
        <Celebrate id={`record-${today}`} text={`🏆 অভিনন্দন! আজ ${todayList.length}টি অর্ডার — এটাই আপনার সবচেয়ে সেরা দিন!`} />
      ) : goalPct >= 100 && lastMonthSales > 0 ? (
        <Celebrate id={`goal-${monthKey}`} text={`🎯 দারুণ! এই মাসের বিক্রি গত মাসকে ছাড়িয়ে গেছে (${goalPct}%)`} />
      ) : null}

      {orders.length > 0 && (
        <div className="ticker" aria-label="সাম্প্রতিক অর্ডার">
          <span className="ticker-live"><i /> LIVE</span>
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="ticker-row" aria-hidden={copy === 1}>
                {orders.slice(0, 12).map((o) => (
                  <span key={o.id} className="ticker-item">
                    🛍️ <b>{o.name}</b>{districtOf(o.address, o.area) ? ` (${districtOf(o.address, o.area)})` : ""} — {o.product}{o.qty > 1 ? ` × ${o.qty}` : ""} • <b className="tk">{money(o.total)}</b> • <em>{agoOf(o.created_at)}</em>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <RangeFilter active={rangeId} from={sp.from} to={sp.to} />

      <section className="kpis">
        {cards.map((c) => (
          <div key={c.label} className="kpi">
            <span className={`kpi-ico k-${c.color}`}><Icon name={c.icon} size={20} /></span>
            <div>
              <small>{c.label}</small>
              <b><CountUp value={c.value} /></b>
              {c.t !== null && (
                <em className={c.t >= 0 ? "up" : "down"}>
                  <Icon name={c.t >= 0 ? "up" : "down"} size={13} /> {Math.abs(c.t)}% <span>আগের সময়ের তুলনায়</span>
                </em>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="dash-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>বিক্রির চিত্র</h3>
              <small>{spanDays <= 31 ? `শেষ ১৫ দিন (${buckets[0].full} – ${buckets[buckets.length - 1].full})` : "মাস অনুযায়ী"} বিক্রি আর অর্ডার</small>
            </div>
            <div className="legend">
              <span><i /> বিক্রি</span>
              <span><i /> অর্ডার</span>
            </div>
          </div>
          <div className="bars2">
            {buckets.map((b) => (
              <div key={b.key} className={`bars2-col ${b.count ? "has" : ""}`} title={`${b.full}: ${money(b.sales)} বিক্রি • ${b.count}টি অর্ডার`}>
                <div className="bars2-pair">
                  {b.count > 0 && <em className="bars2-val">{b.count}</em>}
                  <span className="g" style={{ height: `${(b.sales / maxSales) * 100}%` }} />
                  <span className="o" style={{ height: `${(b.count / maxCount) * 100}%` }} />
                </div>
                <small>{b.label}</small>
                <small className="bars2-sub">{b.sub}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>অর্ডার স্ট্যাটাস</h3>
              <small>{range.label}</small>
            </div>
          </div>
          <div className="donut-wrap">
            <div className="donut" style={{ background: donut }}>
              <div><b>{inR.length}</b><small>অর্ডার</small></div>
              {donutLabels.map((l) => (
                <span key={l.id} className="donut-pct" style={{ left: `${l.x}%`, top: `${l.y}%` }}>{l.pct}%</span>
              ))}
            </div>
            <ul className="donut-legend">
              {statusRows.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/orders?status=${r.id}&${qs}`}>
                    <i style={{ background: r.color }} /> {r.label}
                    <b>{inR.length ? Math.round((r.n / inR.length) * 100) : 0}%</b>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel side-panel">
          <div className="panel-head">
            <div>
              <h3>অসম্পূর্ণ অর্ডার</h3>
              <small className="live-dot">কল করলেই অর্ডার</small>
            </div>
            <Link href="/admin/incomplete" className="view-all">সব <Icon name="arrow" size={13} /></Link>
          </div>
          {incomplete.length === 0 ? (
            <p className="adm-muted empty-note">এখন কোনো অসম্পূর্ণ অর্ডার নেই ✅</p>
          ) : (
            <ul className="mini-list">
              {incomplete.map((r) => (
                <li key={r.phone}>
                  <span className="avatar">{(r.name || "?").trim().slice(0, 1).toUpperCase()}</span>
                  <div>
                    <b>{r.name || "নাম নেই"}</b>
                    <small>{r.phone} • {fmtDate(r.updated_at)}</small>
                  </div>
                  <a href={`tel:${r.phone}`} className="call-btn" aria-label="কল"><Icon name="phone" size={15} /></a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="dash-grid two">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>অর্ডার ক্যালেন্ডার 📅</h3>
              <small>প্রতিদিন কয়টি অর্ডার আর কত বিক্রি — রং যত গাঢ়, অর্ডার তত বেশি</small>
            </div>
          </div>
          <OrderCalendar days={calDays} today={today} />
        </div>

        <div className="panel goal">
          <div className="panel-head">
            <div>
              <h3>এই মাসের লক্ষ্য 🎯</h3>
              <small>গত মাসের বিক্রি ({money(lastMonthSales)}) ছাড়িয়ে যাওয়া</small>
            </div>
          </div>
          <div className="goal-body">
            <div className={`goal-ring ${goalPct >= 100 ? "won" : ""}`} style={{ "--p": Math.min(goalPct, 100) }}>
              <b>{goalPct}%</b>
              <small>{goalPct >= 100 ? "লক্ষ্য পূরণ 🏆" : "পূরণ হয়েছে"}</small>
            </div>
            <ul>
              <li><small>এই মাসে বিক্রি</small><b>{money(monthSales)}</b></li>
              <li><small>দৈনিক গড়</small><b>{money(Math.round(monthSales / dayOfMonth))}</b></li>
              <li><small>মাস শেষে সম্ভাব্য</small><b className="gold">{money(projected)}</b></li>
              <li><small>বাকি দিন</small><b>{daysInMonth - dayOfMonth} দিন</b></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="dash-grid trio">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>জেলা লিডারবোর্ড 🗺️</h3>
              <small>{range.label} • কোন জেলা থেকে বেশি অর্ডার, কোথায় রিটার্ন বেশি</small>
            </div>
          </div>
          {districts.length === 0 ? (
            <p className="adm-muted empty-note">এই সময়ে অর্ডার নেই</p>
          ) : (
            <ul className="dist-list">
              {districts.map(([d, r], i) => {
                const done = r.ok + r.bad;
                const ok = done ? Math.round((r.ok / done) * 100) : null;
                return (
                  <li key={d}>
                    <span className="dist-rank">{i + 1}</span>
                    <div className="dist-main">
                      <div className="dist-top"><b>{d}</b><small>{r.n}টি অর্ডার • {money(r.s)}</small></div>
                      <span className="dist-bar"><i style={{ width: `${(r.n / maxDist) * 100}%` }} /></span>
                    </div>
                    <span className={`dist-ok ${ok === null ? "" : ok >= 80 ? "good" : ok >= 60 ? "mid" : "bad"}`} title="ডেলিভারি সফল">
                      {ok === null ? "—" : `${ok}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>কখন অর্ডার বেশি আসে ⏰</h3>
              <small>সব অর্ডার • অ্যাড চালানোর সেরা সময় বুঝতে</small>
            </div>
          </div>
          <div className="when-grid">
            <span />
            {SLOTS.map((s) => <small key={s} className="when-slot">{s}</small>)}
            {WEEK.map((w, d) => [
              <small key={w} className={`when-day ${d === bestDay && dayTotals[d] ? "best" : ""}`}>{w}</small>,
              ...grid[d].map((n, s) => (
                <span
                  key={`${d}-${s}`}
                  className={`when-cell ${bestCell && bestCell.d === d && bestCell.s === s ? "best" : ""}`}
                  style={{ "--a": n ? 0.15 + (n / maxCell) * 0.85 : 0 }}
                  title={`${w} ${SLOTS[s]} — ${n}টি অর্ডার`}
                >
                  {n || ""}
                </span>
              )),
            ])}
          </div>
          <p className="when-tip">
            {bestCell
              ? <>🔥 সবচেয়ে বেশি অর্ডার: <b>{WEEK_FULL[bestCell.d]} {SLOTS[bestCell.s]}টা</b> • সেরা দিন <b>{WEEK_FULL[bestDay]}</b></>
              : "এখনো যথেষ্ট অর্ডার নেই"}
          </p>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>লয়্যাল কাস্টমার 💎</h3>
              <small>যারা নিয়েছেন আর আবার ফিরে এসেছেন</small>
            </div>
          </div>
          <div className="loyal-stats">
            <div><b>{repeatRate}%</b><small>রিপিট কাস্টমার ({repeat} জন)</small></div>
            <div><b>{money(avgOrder)}</b><small>গড় অর্ডার ({range.label})</small></div>
          </div>
          {loyal.length === 0 ? (
            <p className="adm-muted empty-note">এখনো ডেলিভারড কাস্টমার নেই</p>
          ) : (
            <ul className="loyal-list">
              {loyal.map(([phone, c], i) => (
                <li key={phone}>
                  <span className="loyal-medal">{["🥇", "🥈", "🥉", "4", "5"][i]}</span>
                  <Link href={`/admin/customer/${phone}`}>
                    <b>{c.name}</b>
                    <small>{phone} • {c.n}টি অর্ডার{c.n > 1 ? " 🔁" : ""}</small>
                  </Link>
                  <span className="loyal-amt">{money(c.spent)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="dash-grid trio">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>সেলস ফানেল 🔻</h3>
              <small>{range.label} • কোন ধাপে কাস্টমার হারাচ্ছেন</small>
            </div>
          </div>
          <ul className="funnel">
            {funnel.map((f, i) => {
              const drop = i && funnel[i - 1].n ? Math.round(((funnel[i - 1].n - f.n) / funnel[i - 1].n) * 100) : null;
              return (
                <li key={f.label}>
                  <span className="funnel-bar" style={{ width: `${Math.max(14, (f.n / funnelTop) * 100)}%`, background: f.c }}>
                    <b>{f.n}</b>
                  </span>
                  <small>{f.label}{drop > 0 && <em> −{drop}%</em>}</small>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>টাকা কোথায় আছে 💰</h3>
              <small>সব সময় • মোট {money(flowTotal)}</small>
            </div>
          </div>
          <div className="flow-bar">
            {flow.map((f) => f.v > 0 && (
              <span key={f.label} style={{ width: `${(f.v / flowTotal) * 100}%`, background: f.c }} title={`${f.label}: ${money(f.v)}`} />
            ))}
          </div>
          <ul className="flow-list">
            {flow.map((f) => (
              <li key={f.label}>
                <i style={{ background: f.c }} />
                <small>{f.label}</small>
                <b>{money(f.v)}</b>
              </li>
            ))}
            <li className="loss">
              <i />
              <small>রিটার্নে ডেলিভারি খরচ (আনুমানিক)</small>
              <b>−{money(returnLoss)}</b>
            </li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>রেকর্ড ও সুরক্ষা 🏆</h3>
              <small>আপনার সেরা দিন আর ফ্রড থেকে বাঁচা</small>
            </div>
          </div>
          <div className="rec-grid">
            <div className="rec gold">
              <small>🏆 সেরা দিন</small>
              <b>{record ? `${record.n}টি অর্ডার` : "—"}</b>
              <em>{record ? new Date(record.day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : ""}</em>
            </div>
            <div className="rec fire">
              <small>🔥 টানা অর্ডার</small>
              <b>{streak} দিন</b>
              <em>{streak ? "প্রতিদিন অর্ডার আসছে" : "আজ প্রথম অর্ডারের অপেক্ষা"}</em>
            </div>
            <div className="rec shield">
              <small>🛡️ কম রেটিং আটকানো</small>
              <b>{shield.blocked} নাম্বার</b>
              <em>শেষ ৩০ দিনে{shield.auto_cancel ? ` • ${shield.auto_cancel}টি অটো বাতিল` : ""}</em>
            </div>
          </div>
          {record && (
            <div className="rec-race">
              <div><small>আজ {todayList.length}টি</small><small>রেকর্ড {record.n}টি</small></div>
              <span><i style={{ width: `${Math.min(100, (todayList.length / record.n) * 100)}%` }} /></span>
              <p>{record.day === today ? "🎉 আজই আপনার সেরা দিন!" : `রেকর্ড ভাঙতে আর ${toRecord}টি অর্ডার লাগবে`}</p>
            </div>
          )}
        </div>
      </section>

      <section className="dash-grid one-col">
        <div className="panel game">
          <div className="panel-head">
            <div>
              <h3>লেভেল ও অর্জন 🎮</h3>
              <small>{quote}</small>
            </div>
            <span className="game-count">🏅 {badgesDone}/{BADGES.length} অর্জন</span>
          </div>
          <div className="game-body">
            <div className="lvl-card">
              <span className="lvl-icon">{lvlIcon}</span>
              <small>লেভেল {lvlIdx + 1}</small>
              <b>{lvlName}</b>
              <span className="lvl-bar"><i style={{ width: `${lvlPct}%` }} /></span>
              <em>{nextLvl ? `${xp}/${nextLvl[0]} ডেলিভারি • ${nextLvl[2]} ${nextLvl[1]} হতে আর ${nextLvl[0] - xp}টি` : `${xp} ডেলিভারি — সর্বোচ্চ লেভেল! 🎉`}</em>
            </div>
            <div className="badges">
              {BADGES.map((b) => (
                <div key={b.name} className={`badge-item ${b.done ? "done" : ""}`} title={b.done ? "অর্জিত! 🎉" : `${b.pctDone}% হয়েছে`}>
                  <span className="badge-ico">{b.done ? b.icon : "🔒"}</span>
                  <b>{b.name}</b>
                  {b.done ? (
                    <small className="badge-ok">✓ অর্জিত</small>
                  ) : (
                    <>
                      <span className="badge-bar"><i style={{ width: `${b.pctDone}%` }} /></span>
                      <small>{b.money ? `${money(b.have)} / ${money(b.need)}` : b.pct ? `${b.have}% / ${b.need}%` : `${b.have} / ${b.need}`}</small>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="dash-grid trio">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>অর্ডার কোথা থেকে আসছে 🧭</h3>
              <small>{range.label} • কোন সোর্সের কাস্টমার বেশি কনফার্ম করে</small>
            </div>
          </div>
          {sources.length === 0 ? (
            <p className="adm-muted">এই সময়ে কোনো অর্ডার নেই</p>
          ) : (
            <ul className="src-list">
              {sources.map(([id, r]) => {
                const meta = SOURCES[id];
                const conf = r.sale + r.cancel ? Math.round((r.sale / (r.sale + r.cancel)) * 100) : null;
                return (
                  <li key={id}>
                    <div className="src-top">
                      <b>{meta.icon} {meta.label}</b>
                      <small>{r.n}টি • {Math.round((r.n / inR.length) * 100)}%</small>
                    </div>
                    <span className="src-bar"><i style={{ width: `${(r.n / maxSrc) * 100}%`, background: meta.c }} /></span>
                    <small className="src-sub">
                      কনফার্ম {conf === null ? "—" : `${conf}%`} • ডেলিভারড {r.ok}{r.bad ? ` • রিটার্ন ${r.bad}` : ""}
                    </small>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>কুরিয়ার তুলনা 🚚</h3>
              <small>{range.label} • কোন কুরিয়ারে পার্সেল বেশি পৌঁছায়</small>
            </div>
          </div>
          {couriersCmp.length === 0 ? (
            <p className="adm-muted">এই সময়ে কুরিয়ারে কোনো পার্সেল যায়নি</p>
          ) : (
            <>
              <ul className="cmp-list">
                {couriersCmp.map((c) => (
                  <li key={c.name} className={c.rate === null ? "" : c.rate >= 80 ? "good" : c.rate >= 60 ? "mid" : "bad"}>
                    <span className="cmp-ring" style={{ "--p": c.rate ?? 0 }}><b>{c.rate === null ? "—" : `${c.rate}%`}</b></span>
                    <div>
                      <b>{c.icon} {c.name}</b>
                      <small>{c.n} পার্সেল • ✅ {c.ok} • ↩️ {c.bad}{c.way ? ` • 🚚 পথে ${c.way}` : ""}</small>
                    </div>
                  </li>
                ))}
              </ul>
              {bestCourier && couriersCmp.length > 1 && (
                <p className="cmp-tip">🏆 সেরা: <b>{bestCourier.name}</b> — {bestCourier.rate}% পার্সেল ডেলিভারড</p>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>আবার কেনার সময় 🔁</h3>
              <small>২০–৬০ দিন আগে ডেলিভারড, আর অর্ডার করেনি • {reorder.length} জন</small>
            </div>
          </div>
          <ReorderList list={reorder.slice(0, 30)} />
        </div>
      </section>

      <section className="dash-grid two">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>সাম্প্রতিক অর্ডার</h3>
              <small>সর্বশেষ আগে • {Math.min(show, orders.length)}/{orders.length}টি দেখাচ্ছে — স্ক্রল করে বাকিগুলো দেখুন</small>
            </div>
            <div className="recent-tools">
              <RecentLimit value={show} />
              <Link href="/admin/orders" className="view-all">সব দেখুন <Icon name="arrow" size={13} /></Link>
            </div>
          </div>
          {orders.length === 0 ? (
            <p className="adm-muted empty-note">এখনো কোনো অর্ডার আসেনি</p>
          ) : (
            <div className="adm-table-wrap recent-scroll">
              <table className="adm-table t2">
                <thead>
                  <tr><th>আইডি</th><th>কাস্টমার</th><th>পণ্য</th><th>টাকা</th><th>স্ট্যাটাস</th><th>তারিখ</th></tr>
                </thead>
                <tbody>
                  {orders.slice(0, show).map((o) => (
                    <tr key={o.id}>
                      <td><b>#{orderCode(o.id, settings.brand)}</b></td>
                      <td>{o.name}</td>
                      <td className="t-prod">{o.product} × {o.qty}</td>
                      <td><b>{money(o.total)}</b></td>
                      <td><span className={`chip st-${o.status}`}>{label[o.status] || o.status}</span></td>
                      <td className="t-date">{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>টপ সেলিং পণ্য</h3>
              <small>{range.label} • কনফার্মড</small>
            </div>
            <Link href="/admin/products" className="view-all">সব <Icon name="arrow" size={13} /></Link>
          </div>
          {top.length === 0 ? (
            <p className="adm-muted empty-note">এই সময়ে কনফার্মড বিক্রি নেই</p>
          ) : (
            <ul className="top-list">
              {top.map(([name, qty]) => {
                const p = stockOf(name);
                return (
                  <li key={name}>
                    {p?.image ? <img src={p.image} alt="" /> : <span className="top-ph"><Icon name="box" size={16} /></span>}
                    <div>
                      <b>{name}</b>
                      <small>{money(p?.price || 0)}</small>
                    </div>
                    <span className="top-num"><b>{qty}</b><small>বিক্রি</small></span>
                    <span className={`top-num ${p && p.stock <= 5 ? "low" : ""}`}><b>{p?.stock ?? "—"}</b><small>স্টক</small></span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
