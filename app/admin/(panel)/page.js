import Link from "next/link";
import { sql, ensureTables, STATUSES, orderCode } from "@/lib/db";
import { getProducts, getSettings } from "@/lib/store";

const dhakaDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const money = (n) => `৳${Number(n).toLocaleString("en-IN")}`;

export default async function Dashboard() {
  await ensureTables();
  const [orders, products, settings, top] = await Promise.all([
    sql`SELECT id, created_at, name, phone, total, status FROM orders ORDER BY created_at DESC`,
    getProducts({ all: true }),
    getSettings(),
    sql`SELECT product, SUM(qty)::int AS qty, SUM(total)::int AS amount FROM orders
        WHERE status NOT IN ('cancelled', 'returned') GROUP BY product ORDER BY qty DESC LIMIT 5`,
  ]);

  const today = dhakaDay(new Date());
  const count = (s) => orders.filter((o) => o.status === s).length;
  const sum = (list) => list.reduce((t, o) => t + o.total, 0);

  const cards = [
    { icon: "🆕", color: "blue", label: "আজকের অর্ডার", value: orders.filter((o) => dhakaDay(o.created_at) === today).length },
    { icon: "⏳", color: "yellow", label: "পেন্ডিং অর্ডার", value: count("pending") },
    { icon: "📦", color: "purple", label: "মোট অর্ডার", value: orders.length },
    { icon: "💰", color: "green", label: "ডেলিভারড বিক্রি", value: money(sum(orders.filter((o) => o.status === "delivered"))) },
    { icon: "🚚", color: "orange", label: "প্রক্রিয়াধীন মূল্য", value: money(sum(orders.filter((o) => ["pending", "confirmed", "shipped"].includes(o.status)))) },
    { icon: "🛍️", color: "dark", label: "মোট পণ্য", value: products.length },
  ];

  // Gত ৭ দিনের অর্ডার
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    const key = dhakaDay(d);
    return {
      key,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }),
      count: orders.filter((o) => dhakaDay(o.created_at) === key).length,
    };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  const lowStock = products.filter((p) => p.active && p.stock <= 5);
  const label = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));

  return (
    <>
      <h1 className="adm-title">ড্যাশবোর্ড</h1>

      <section className="adm-cards">
        {cards.map((c) => (
          <div key={c.label} className="adm-card">
            <span className={`adm-icon ${c.color}`}>{c.icon}</span>
            <small>{c.label}</small>
            <b>{c.value}</b>
          </div>
        ))}
      </section>

      <section className="adm-box">
        <h3 className="adm-box-sub">অর্ডার স্ট্যাটাস — ক্লিক করে দেখুন</h3>
        <div className="adm-status">
          {STATUSES.map((s) => (
            <Link key={s.id} href={`/admin/orders?status=${s.id}`} className={`st st-${s.id}`}>
              <b>{count(s.id)}</b>
              <span>{s.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="adm-grid">
        <div className="adm-box">
          <h3>গত ৭ দিনের অর্ডার</h3>
          <div className="adm-chart">
            {days.map((d) => (
              <div key={d.key} className="bar-col">
                <span className="bar-val">{d.count}</span>
                <div className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="adm-box">
          <h3>⚠️ কম স্টক (৫ বা কম)</h3>
          {lowStock.length === 0 ? (
            <p className="adm-muted">সব পণ্যের পর্যাপ্ত স্টক আছে ✅</p>
          ) : (
            <ul className="adm-list">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                  <b className="danger">{p.stock} টি</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="adm-grid">
        <div className="adm-box">
          <div className="adm-box-head">
            <h3>সাম্প্রতিক অর্ডার</h3>
            <Link href="/admin/orders" className="adm-link">সব দেখুন →</Link>
          </div>
          {orders.length === 0 ? (
            <p className="adm-muted">এখনো কোনো অর্ডার আসেনি</p>
          ) : (
            <table className="adm-table">
              <thead>
                <tr><th>আইডি</th><th>কাস্টমার</th><th>মোট</th><th>স্ট্যাটাস</th></tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.id}>
                    <td><b>{orderCode(o.id, settings.brand)}</b></td>
                    <td>{o.name}<small>{o.phone}</small></td>
                    <td><b>{money(o.total)}</b></td>
                    <td><span className={`pill st-${o.status}`}>{label[o.status] || o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="adm-box">
          <h3>🏆 টপ সেলিং পণ্য</h3>
          {top.length === 0 ? (
            <p className="adm-muted">অর্ডার এলে এখানে দেখাবে</p>
          ) : (
            <ul className="adm-list">
              {top.map((t, i) => (
                <li key={t.product}>
                  <span>{i + 1}. {t.product}</span>
                  <b>{t.qty} টি</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
