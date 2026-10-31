import { requireAdmin } from "@/lib/auth";
import { sql, ensureTables, orderCode } from "@/lib/db";
import { getSettings } from "@/lib/store";
import { courierName } from "@/lib/courier";
import PrintNow from "./PrintNow";
import "./print.css";

export const metadata = { title: "প্যাকিং স্লিপ", robots: { index: false } };

const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric" });

// Order page theke "🖨 প্রিন্ট" — ek A4 e 4 ta packing slip (box e lagano + COD taka sposhto)
export default async function PrintPage({ searchParams }) {
  await requireAdmin();
  const ids = String((await searchParams).ids || "").split(",").map(Number).filter((n) => n > 0).slice(0, 300);
  await ensureTables();
  const [rows, s] = await Promise.all([
    ids.length ? sql`SELECT * FROM orders WHERE id = ANY(${ids})` : [],
    getSettings(),
  ]);
  // Order page e je kromey chhilo shei kromei
  const orders = ids.map((id) => rows.find((o) => Number(o.id) === id)).filter(Boolean);

  return (
    <div className="slips">
      <div className="print-bar">
        <b>{orders.length}টি স্লিপ</b>
        <PrintNow />
      </div>
      {orders.map((o) => (
        <article key={o.id} className="slip">
          <header>
            {s.logo ? <img src={s.logo} alt={s.brand} /> : <b className="slip-brand">{s.brand}</b>}
            <div>
              <b className="slip-code">{orderCode(o.id, s.brand)}</b>
              <small>{fmtDate(o.created_at)}</small>
            </div>
          </header>
          <div className="slip-to">
            <small>প্রাপক</small>
            <b>{o.name}</b>
            <b className="slip-phone">📞 {o.phone}</b>
            <p>{o.address}</p>
          </div>
          <div className="slip-item">
            <span>{o.product}</span>
            <b>× {o.qty}</b>
          </div>
          <div className="slip-cod">
            <small>ক্যাশ অন ডেলিভারি</small>
            <b>৳{Number(o.total).toLocaleString("en-IN")}</b>
          </div>
          <footer>
            {o.courier_id ? (
              <span>🚚 {courierName(o)} • <b>{o.tracking_code || o.courier_id}</b></span>
            ) : (
              <span>🚚 কুরিয়ার: ______________</span>
            )}
            {o.note && <small>📝 {o.note}</small>}
            <small>প্রেরক: {s.brand}{s.phone ? ` • ${s.phone}` : ""} — পার্সেল খুলে দেখে টাকা দিন, ধন্যবাদ ❤️</small>
          </footer>
        </article>
      ))}
      {orders.length === 0 && <p>কোনো অর্ডার বাছাই করা হয়নি</p>}
    </div>
  );
}
