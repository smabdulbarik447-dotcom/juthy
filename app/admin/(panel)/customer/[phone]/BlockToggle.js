"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockValue, unblock } from "../../../actions";

export default function BlockToggle({ phone, blocked }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn) => startTransition(async () => { await fn(); router.refresh(); });
  return blocked ? (
    <button type="button" className="adm-btn ghost" disabled={pending} onClick={() => confirm(`${phone} আনব্লক করবেন?`) && run(() => unblock("phone", phone))}>
      ✅ আনব্লক
    </button>
  ) : (
    <button
      type="button"
      className="adm-btn danger"
      disabled={pending}
      onClick={() => confirm(`${phone} ব্লক করবেন? এই নাম্বার থেকে আর অর্ডার করা যাবে না।`) && run(() => blockValue("phone", phone, "প্রোফাইল থেকে ব্লক"))}
    >
      🚫 ব্লক
    </button>
  );
}
