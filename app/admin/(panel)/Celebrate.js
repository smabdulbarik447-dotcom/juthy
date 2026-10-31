"use client";

import { useEffect } from "react";
import { confetti } from "./confetti";

// Record bhangle / masher lokkho purno hole din e ekbar confetti (ei browser e mone rakhe)
export default function Celebrate({ id, text }) {
  useEffect(() => {
    const key = `celebrated:${id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    const t = setTimeout(() => confetti(160), 600);
    return () => clearTimeout(t);
  }, [id]);
  return <div className="celebrate-banner">{text}</div>;
}
