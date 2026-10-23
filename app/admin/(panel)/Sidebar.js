"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const MENU = [
  { href: "/admin", icon: "📊", label: "ড্যাশবোর্ড" },
  { href: "/admin/orders", icon: "📦", label: "অর্ডার" },
  { href: "/admin/incomplete", icon: "⏳", label: "অসম্পূর্ণ অর্ডার" },
  { href: "/admin/products", icon: "🛍️", label: "পণ্য" },
  { href: "/admin/products/new", icon: "➕", label: "নতুন পণ্য" },
  { href: "/admin/banners", icon: "🖼️", label: "ব্যানার" },
  { href: "/admin/courier", icon: "🚚", label: "কুরিয়ার (Steadfast/Pathao)" },
  { href: "/admin/fraud", icon: "🛡️", label: "ফেক অর্ডার প্রোটেকশন" },
  { href: "/admin/telegram", icon: "✈️", label: "Telegram নোটিফিকেশন" },
  { href: "/admin/tracking", icon: "📈", label: "ট্র্যাকিং কোড (Pixel/GTM)" },
  { href: "/admin/settings", icon: "⚙️", label: "সাইট সেটিংস" },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // "/admin/products/12" (edit) e পণ্য active thakbe, "/admin/products/new" e নতুন পণ্য
  const isActive = (href) =>
    path === href || (href === "/admin/products" && /^\/admin\/products\/\d+$/.test(path));

  return (
    <>
      <button className="adm-burger" onClick={() => setOpen(!open)} aria-label="মেনু">☰ মেনু</button>
      <nav className={`adm-nav ${open ? "open" : ""}`}>
        {MENU.map((m) => (
          <Link key={m.href} href={m.href} className={isActive(m.href) ? "active" : ""} onClick={() => setOpen(false)}>
            <span>{m.icon}</span> {m.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
