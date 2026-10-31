import Link from "next/link";
import { sql, ensureTables, STATUSES, orderCode } from "@/lib/db";
import { getSettings } from "@/lib/store";
import { cachedHistory } from "@/lib/bdcourier";
import { money } from "@/lib/dateRange";
import { districtOf } from "@/lib/districts";
import BlockToggle from "./BlockToggle";

const fmtDate = (d) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

// Ek number er puro itihash: shob order, koto taka, ডেলিভারড/রিটার্ন, BD Courier rating, block
export default async function CustomerPage({ params }) {
  const phone = decodeURIComponent((await params).phone).replace(/\D/g, "");
  await ensureTables();
  const [orders, settings, blocked, hist] = await Promise.all([
    sql`SELECT * FROM orders WHERE phone = ${phone} ORDER BY created_at DESC`,
    getSettings(),
    sql`SELECT reason FROM blocked WHERE kind = 'phone' AND value = ${phone}`,
    cachedHistory([phone]),
  ]);
  const h = hist[phone];
  const label = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));
  const of = (st) => orders.filter((o) => o.status === st);
  const spent = of("delivered").reduce((t, o) => t + o.total, 0);
  const done = of("delivered").length + of("returned").length;
  const ourRate = done ? Math.round((of("delivered").length / done) * 100) : null;
  const names = [...new Set(orders.map((o) => o.name.trim()))];
  const addresses = [...new Set(orders.map((o) => o.address.trim()))];
  const favMap = {};
  for (const o of orders) favMap[o.product] = (favMap[o.product] || 0) + o.qty;
  const fav = Object.entries(favMap).sort((a, b) => b[1] - a[1])[0];
  const first = orders.at(-1);
  const level = h?.total ? (h.rate >= 80 ? "good" : h.rate >= 50 ? "mid" : "bad") : null;
  const badge =
    orders.length === 0 ? "নতুন নাম্বার" :
    of("returned").length > of("delivered").length ? "⚠️ ঝুঁকিপূর্ণ" :
    of("delivered").length >= 3 ? "👑 VIP কাস্টমার" :
    of("delivered").length >= 2 ? "🔁 নিয়মিত কাস্টমার" : "🙂 কাস্টমার";

  return (
    <>
      <div className="adm-title-row">
        <h1 className="adm-title">কাস্টমার প্রোফাইল</h1>
        <Link href="/admin/orders" className="adm-btn ghost">← সব অর্ডার</Link>
      </div>

      <div className="adm-box cust-head">
        <div className="cust-avatar">{(names[0] || "?").slice(0, 1)}</div>
        <div className="cust-main">
          <h2>{names[0] || "—"} <span className="cust-badge">{badge}</span></h2>
          {names.length > 1 && <small className="adm-muted">অন্য নামেও অর্ডার: {names.slice(1).join(", ")}</small>}
          <div className="contact">
            <a href={`tel:${phone}`}>📞 {phone}</a>
            <a href={`https://wa.me/88${phone}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
            {first && <span>🗓 প্রথম অর্ডার {fmtDate(first.created_at)}</span>}
          </div>
          {blocked[0] && <p className="adm-err">🚫 ব্লকড{blocked[0].reason ? ` — ${blocked[0].reason}` : ""}</p>}
        </div>
        <BlockToggle phone={phone} blocked={Boolean(blocked[0])} />
      </div>

      <section className="adm-cards fraud-cards">
        <div className="adm-card"><span className="adm-icon blue">🛒</span><small>মোট অর্ডার</small><b>{orders.length}টি</b></div>
        <div className="adm-card"><span className="adm-icon green">✅</span><small>ডেলিভারড</small><b>{of("delivered").length}টি • {money(spent)}</b></div>
        <div className="adm-card"><span className="adm-icon red">↩️</span><small>রিটার্ন / বাতিল</small><b>{of("returned").length} / {of("cancelled").length}</b></div>
        <div className="adm-card"><span className="adm-icon yellow">🎯</span><small>আমাদের কাছে রিসিভ রেট</small><b>{ourRate === null ? "—" : `${ourRate}%`}</b></div>
      </section>

      <div className="adm-grid even">
        <div className="adm-box">
          <h3>📦 সব কুরিয়ারে রেটিং (BD Courier)</h3>
          {!h ? (
            <p className="adm-muted">এখনো চেক হয়নি — অর্ডার পেজে এই নাম্বারের ⟳ চাপুন</p>
          ) : !h.total ? (
            <p>🆕 আগে কোনো কুরিয়ারে পার্সেল নেই</p>
          ) : (
            <>
              <p className={`cust-rate ${level}`}>
                <b>{h.rate}%</b> রিসিভ • {100 - h.rate}% রিটার্ন <small>({h.delivered}/{h.total} পার্সেল{h.reports ? ` • ⚠️ ${h.reports} রিপোর্ট` : ""})</small>
              </p>
              <ul className="cust-couriers">
                {h.couriers?.map((c) => (
                  <li key={c.name}><span>{c.name}</span><small>{c.total} পার্সেল • ✅ {c.delivered} • ↩️ {c.returned}</small></li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="adm-box">
          <h3>📍 ঠিকানা ও পছন্দ</h3>
          <ul className="cust-addr">
            {addresses.map((a) => (
              <li key={a}>{a}{districtOf(a) ? <small> • {districtOf(a)}</small> : null}</li>
            ))}
            {addresses.length === 0 && <li className="adm-muted">—</li>}
          </ul>
          {fav && <p>❤️ প্রিয় পণ্য: <b>{fav[0]}</b> ({fav[1]}টি)</p>}
          {orders.length > 0 && <p>💵 গড় অর্ডার: <b>{money(orders.reduce((t, o) => t + o.total, 0) / orders.length)}</b></p>}
        </div>
      </div>

      <div className="adm-box">
        <h3>🧾 সব অর্ডার ({orders.length})</h3>
        {orders.length === 0 ? (
          <p className="adm-muted">এই নাম্বার থেকে কোনো অর্ডার নেই</p>
        ) : (
          <div className="cust-orders">
            {orders.map((o) => {
              const code = orderCode(o.id, settings.brand);
              return (
                <Link key={o.id} href={`/admin/orders?q=${code}`} className="cust-order">
                  <span className="order-id">{code}</span>
                  <small>{fmtDate(o.created_at)}</small>
                  <span className="cust-prod">{o.product} × {o.qty}</span>
                  <b>{money(o.total)}</b>
                  <span className={`badge st-${o.status}`}>{label[o.status] || o.status}</span>
                  {o.note && <small className="cust-note">📝 {o.note}</small>}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
