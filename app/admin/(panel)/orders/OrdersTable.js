"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStatus, updateNote, deleteOrder, blockOrder, unblock, sendToCourier } from "../../actions";

// Steadfast er status (Pathao er status English e ashe, sheta i dekhai)
const COURIER_STATUS = {
  in_review: "রিভিউতে", pending: "পথে আছে", hold: "হোল্ড", delivered: "ডেলিভারড",
  partial_delivered: "আংশিক ডেলিভারড", cancelled: "বাতিল/রিটার্ন", unknown: "অজানা",
  delivered_approval_pending: "ডেলিভারড (অনুমোদন বাকি)", cancelled_approval_pending: "বাতিল (অনুমোদন বাকি)",
  partial_delivered_approval_pending: "আংশিক ডেলিভারড (অনুমোদন বাকি)", unknown_approval_pending: "অজানা",
};

// Courier e pathano thakle tracking, na thakle chalu courier gulor "পাঠান" button
function Courier({ o, run, couriers }) {
  if (o.courier_id) {
    return (
      <a className="courier-chip" href={o.track} target="_blank" rel="noreferrer">
        {o.courier_icon} {o.courier_name} • {o.tracking_code} • {COURIER_STATUS[o.courier_status] || o.courier_status || "পাঠানো"}
      </a>
    );
  }
  if (o.status === "cancelled" || o.status === "delivered" || o.status === "returned") return null;
  if (!couriers.length) {
    return <a className="courier-chip muted" href="/admin/courier">🚚 কুরিয়ার সেট করুন</a>;
  }
  return (
    <div className="courier-btns">
      {couriers.map((c) => (
        <button
          key={c.id}
          className={`courier-send ${c.id}`}
          onClick={() =>
            confirm(`${o.code} — ${o.name} (৳${o.total}) ${c.name} এ পাঠাবেন?`) &&
            run(async () => {
              const r = await sendToCourier(o.id, c.id);
              if (r?.error) alert(`${c.name} এ পাঠানো যায়নি:\n${r.error}`);
            })
          }
        >
          {c.icon} {c.name} এ পাঠান
        </button>
      ))}
    </div>
  );
}

// কনফার্ম korar por auto courier entry er fol
const autoMsg = (a) =>
  a.error
    ? `✅ কনফার্ম হয়েছে, কিন্তু ${a.courier} এ অটো পাঠানো যায়নি:\n${a.error}`
    : `✅ কনফার্ম + ${a.courier} এ এন্ট্রি হয়েছে\nট্র্যাকিং: ${a.tracking}`;

// Customer er ager order dekhe jhuki bojha: beshi বাতিল/রিটার্ন = লাল
function Risk({ h }) {
  if (!h || h.total <= 1) return <span className="risk new">🆕 নতুন কাস্টমার</span>;
  const level = h.bad === 0 ? "good" : h.bad >= h.delivered ? "bad" : "mid";
  return (
    <span className={`risk ${level}`}>
      {level === "bad" ? "⚠️" : "🔁"} মোট {h.total} অর্ডার • ডেলিভারড {h.delivered} • বাতিল/রিটার্ন {h.bad}
    </span>
  );
}

const AREA = { inside: "ঢাকার ভেতরে", outside: "ঢাকার বাইরে" };

const fmtDate = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

function downloadCsv(rows) {
  const head = ["Order", "Date", "Name", "Phone", "Address", "Product", "Area", "Qty", "Total", "Status", "Note"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((o) =>
    [o.code, fmtDate(o.created_at), o.name, o.phone, o.address, o.product, AREA[o.area] || o.area, o.qty, o.total, o.status, o.note]
      .map(esc)
      .join(",")
  );
  const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function OrdersTable({ orders, statuses, initialFilter, couriers = [] }) {
  const router = useRouter();
  const [filter, setFilter] = useState(initialFilter);
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();

  const label = Object.fromEntries(statuses.map((s) => [s.id, s.label]));

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (filter === "all" || o.status === filter) &&
        (!term || `${o.code} ${o.name} ${o.phone} ${o.address}`.toLowerCase().includes(term))
    );
  }, [orders, filter, q]);

  const run = (fn) => startTransition(async () => { await fn(); router.refresh(); });

  return (
    <section className={`orders ${pending ? "busy" : ""}`}>
      <div className="toolbar">
        <div className="tabs">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            সব ({orders.length})
          </button>
          {statuses.map((s) => (
            <button key={s.id} className={filter === s.id ? "active" : ""} onClick={() => setFilter(s.id)}>
              {s.label} ({orders.filter((o) => o.status === s.id).length})
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="নাম / ফোন / আইডি দিয়ে খুঁজুন" />
          <button className="adm-btn ghost" onClick={() => downloadCsv(list)}>⬇ CSV</button>
          <button className="adm-btn ghost" onClick={() => router.refresh()}>⟳</button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="empty">কোনো অর্ডার নেই</p>
      ) : (
        <div className="order-list">
          {list.map((o) => (
            <article key={o.id} className={`order st-${o.status}`}>
              <div className="order-head">
                <span className="order-id">{o.code}</span>
                <span className="order-date">{fmtDate(o.created_at)}</span>
                {o.blocked && <span className="badge blocked">🚫 ব্লকড</span>}
                <span className={`badge st-${o.status}`}>{label[o.status] || o.status}</span>
              </div>
              <Risk h={o.history} />

              <div className="order-body">
                <div>
                  <b className="cust">{o.name}</b>
                  <div className="contact">
                    <a href={`tel:${o.phone}`}>📞 {o.phone}</a>
                    <a href={`https://wa.me/88${o.phone}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
                  </div>
                  <p className="addr">📍 {o.address}</p>
                  {o.ip && <small className="ip">IP: {o.ip}</small>}
                </div>
                <div className="order-prod">
                  <span>{o.product || "—"}</span>
                  <small>Qty: {o.qty} • {AREA[o.area] || o.area}</small>
                  <b>৳{o.total.toLocaleString("en-IN")}</b>
                  <Courier o={o} run={run} couriers={couriers} />
                </div>
              </div>

              <div className="order-actions">
                <select
                  value={o.status}
                  onChange={(e) => {
                    const next = e.target.value;
                    run(async () => {
                      const auto = await updateStatus(o.id, next);
                      if (auto) alert(autoMsg(auto));
                    });
                  }}
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <input
                  className="note"
                  defaultValue={o.note}
                  placeholder="নোট (যেমন: কুরিয়ার ট্র্যাকিং)"
                  onBlur={(e) => e.target.value !== o.note && run(() => updateNote(o.id, e.target.value))}
                />
                {o.blocked ? (
                  <button
                    className="block-btn"
                    title="আনব্লক"
                    onClick={() =>
                      confirm(`${o.phone} আনব্লক করবেন?`) &&
                      run(async () => {
                        await unblock("phone", o.phone);
                        if (o.ip) await unblock("ip", o.ip);
                      })
                    }
                  >
                    ✅
                  </button>
                ) : (
                  <button
                    className="block-btn"
                    title="ফেক — ব্লক করুন"
                    onClick={() =>
                      confirm(`${o.code} ফেক অর্ডার? নাম্বার ও IP ব্লক হবে, অর্ডার বাতিল হবে।`) && run(() => blockOrder(o.id))
                    }
                  >
                    🚫
                  </button>
                )}
                <button
                  className="del"
                  title="ডিলিট"
                  onClick={() => confirm(`${o.code} অর্ডারটি ডিলিট করবেন?`) && run(() => deleteOrder(o.id))}
                >
                  🗑
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
