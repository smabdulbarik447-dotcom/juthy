"use client";

import { useEffect, useState } from "react";

const bn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[d]);
const agoText = (min) => (min < 60 ? `${bn(Math.max(1, min))} মিনিট আগে` : min < 1440 ? `${bn(Math.round(min / 60))} ঘণ্টা আগে` : `${bn(Math.round(min / 1440))} দিন আগে`);

// Asol shamprotik order (shudhu prothom nam + jela) — kichukkhon por por niche choto popup e
export default function SocialProof() {
  const [list, setList] = useState([]);
  const [i, setI] = useState(-1);

  useEffect(() => {
    fetch("/api/recent-orders").then((r) => r.json()).then((d) => setList(d.orders || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!list.length) return;
    let n = 0;
    let hide;
    const show = () => {
      setI(n % list.length);
      n += 1;
      hide = setTimeout(() => setI(-1), 5000);
    };
    const first = setTimeout(show, 8000);
    const loop = setInterval(show, 18000);
    return () => { clearTimeout(first); clearInterval(loop); clearTimeout(hide); };
  }, [list]);

  const o = list[i];
  if (!o) return null;
  return (
    <a href="#order" className="sp-toast" key={i}>
      <span className="sp-ico">🛍️</span>
      <span className="sp-txt">
        <b>{o.name}{o.place ? `, ${o.place}` : ""}</b>
        <span>অর্ডার করেছেন {o.product}</span>
        <small>✅ {agoText(o.min)}</small>
      </span>
    </a>
  );
}
