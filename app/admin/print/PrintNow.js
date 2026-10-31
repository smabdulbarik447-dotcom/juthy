"use client";

import { useEffect } from "react";

// Page khulle nije thekei print dialog
export default function PrintNow() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);
  return <button type="button" onClick={() => window.print()}>🖨 প্রিন্ট করুন</button>;
}
