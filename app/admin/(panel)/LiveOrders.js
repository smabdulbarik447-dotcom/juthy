"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { newOrdersAction } from "../actions";
import { confetti, chime } from "./confetti";

const money = (n) => `৳${Number(n).toLocaleString("en-IN")}`;

// Admin er je kono page khola thakle 15 second por por notun order dekhe — ashlei popup + shobdo + confetti
export default function LiveOrders() {
  const router = useRouter();
  const last = useRef(0);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (document.hidden) return;
      try {
        const r = await newOrdersAction(last.current);
        if (!alive) return;
        if (last.current && r.orders.length) {
          setToasts((t) => [...r.orders.map((o) => ({ ...o, at: Date.now() })), ...t].slice(0, 4));
          chime();
          confetti(90);
          router.refresh();
        }
        last.current = Math.max(last.current, r.last);
      } catch {}
    };
    run();
    const t = setInterval(run, 15000);
    const onShow = () => !document.hidden && run();
    document.addEventListener("visibilitychange", onShow);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [router]);

  // 9 second por popup nije chole jay
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((l) => l.filter((x) => Date.now() - x.at < 9000)), 9200);
    return () => clearTimeout(t);
  }, [toasts]);

  if (!toasts.length) return null;
  return (
    <div className="live-toasts">
      {toasts.map((o) => (
        <Link key={o.id} href="/admin/orders?status=pending" className="live-toast">
          <span className="live-bell">🔔</span>
          <span className="live-txt">
            <small>নতুন অর্ডার এসেছে!</small>
            <b>{o.name}{o.place ? ` • ${o.place}` : ""}</b>
            <em>{o.product}{o.qty > 1 ? ` × ${o.qty}` : ""}</em>
          </span>
          <b className="live-amt">{money(o.total)}</b>
        </Link>
      ))}
    </div>
  );
}
