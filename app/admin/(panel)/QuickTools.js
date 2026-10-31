"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendTodayReportAction } from "../actions";

/** Order khoja (ID/nam/number/thikana) + আজকের হিসাব Telegram e */
export function QuickBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="qbar">
      <form
        className="qbar-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/admin/orders?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <span>🔍</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="অর্ডার খুঁজুন — নাম্বার, নাম, আইডি বা ঠিকানা লিখে Enter চাপুন" />
      </form>
      <button
        type="button"
        className="qbar-btn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await sendTodayReportAction();
            setMsg(r.ok ? "✓ পাঠানো হয়েছে" : `সমস্যা: ${r.error}`);
            setTimeout(() => setMsg(""), 4000);
          })
        }
      >
        {pending ? "পাঠানো হচ্ছে..." : msg || "📤 আজকের হিসাব Telegram এ"}
      </button>
    </div>
  );
}

/** আবার কেনার সময়: WhatsApp e mone koriye dewa — kake pathano hoyeche ei browser e mone rakhe (30 din) */
const SENT_KEY = "reorder_sent";
const readSent = () => {
  try {
    const all = JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
    return Object.fromEntries(Object.entries(all).filter(([, t]) => Date.now() - t < 30 * 864e5));
  } catch {
    return {};
  }
};

export function ReorderList({ list }) {
  const [sent, setSent] = useState({});
  useEffect(() => setSent(readSent()), []);
  const mark = (phone) => {
    const next = { ...readSent(), [phone]: Date.now() };
    setSent(next);
    try { localStorage.setItem(SENT_KEY, JSON.stringify(next)); } catch {}
  };
  if (!list.length) return <p className="adm-muted">এখন কাউকে মনে করানোর নেই — ডেলিভারির ২০ দিন পর এখানে আসবে</p>;
  const left = list.filter((c) => !sent[c.phone]).length;
  return (
    <>
      <p className="ro-left">{left ? `${left} জনকে মেসেজ দেওয়া বাকি` : "✅ সবাইকে মেসেজ দেওয়া হয়েছে"}</p>
      <ul className="ro-list">
        {list.map((c) => (
          <li key={c.phone} className={sent[c.phone] ? "done" : ""}>
            <div>
              <Link href={`/admin/customer/${c.phone}`}><b>{c.name}</b></Link>
              <small>{c.product} • {c.days} দিন আগে</small>
            </div>
            <a href={`tel:${c.phone}`} className="ro-btn" title="কল">📞</a>
            <a href={c.wa} target="_blank" rel="noreferrer" className="ro-btn wa" onClick={() => mark(c.phone)} title="WhatsApp এ মনে করান">
              {sent[c.phone] ? "✓" : "💬"}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
