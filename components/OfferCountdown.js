"use client";

import { useEffect, useState } from "react";

const bn = (n) => String(n).padStart(2, "0").replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);

// Admin > সাইট সেটিংস e deya shomoy porjonto offer er ulto ghori; shomoy shesh hole nije lukiye jay
export default function OfferCountdown({ end, text, compact = false }) {
  const target = end ? Date.parse(`${end}:00+06:00`) : NaN;
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (!target) return;
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);

  if (!target || left === null || left <= 0) return null;
  const s = Math.floor(left / 1000);
  const parts = [
    [Math.floor(s / 86400), "দিন"],
    [Math.floor((s % 86400) / 3600), "ঘণ্টা"],
    [Math.floor((s % 3600) / 60), "মিনিট"],
    [s % 60, "সেকেন্ড"],
  ].filter(([v], i) => i > 0 || v > 0);

  return (
    <div className={`offer-cd ${compact ? "compact" : ""}`}>
      <span className="offer-cd-text">{text}</span>
      <span className="offer-cd-boxes">
        {parts.map(([v, label]) => (
          <span key={label} className="offer-cd-box"><b>{bn(v)}</b><small>{label}</small></span>
        ))}
      </span>
    </div>
  );
}
