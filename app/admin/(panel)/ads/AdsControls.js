"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adsToggleAction, adsBudgetAction, adsRunRulesAction } from "../../actions";

/** Campaign/ad set chalu-bondho switch */
export function AdToggle({ id, on, name }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  return (
    <span className="ad-toggle-wrap">
      <button
        type="button"
        className={`ad-switch ${on ? "on" : ""}`}
        disabled={pending}
        aria-label={on ? "বন্ধ করুন" : "চালু করুন"}
        onClick={() =>
          confirm(on ? `"${name}" বন্ধ করবেন?` : `"${name}" চালু করবেন? চালু করলে Facebook আবার টাকা খরচ শুরু করবে।`) &&
          startTransition(async () => {
            const r = await adsToggleAction(id, !on);
            setErr(r.error || "");
            router.refresh();
          })
        }
      >
        <i />
      </button>
      {err && <small className="adm-err">{err}</small>}
    </span>
  );
}

/** Daily budget bodlano — barale alada kore jiggesh kore */
export function BudgetEdit({ id, value, currency }) {
  const router = useRouter();
  const [v, setV] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const changed = Number(v) > 0 && Number(v) !== Number(value);
  return (
    <form
      className="ad-budget"
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return;
        const up = Number(v) > Number(value || 0);
        if (!confirm(`দৈনিক বাজেট ${value ?? "—"} → ${v} ${currency} করবেন?${up ? "\nবাজেট বাড়লে Facebook প্রতিদিন বেশি টাকা খরচ করবে।" : ""}`)) return;
        startTransition(async () => {
          const r = await adsBudgetAction(id, Number(v));
          setMsg(r.ok ? "✓" : r.error);
          router.refresh();
        });
      }}
    >
      <input type="number" min="1" step="0.01" value={v} onChange={(e) => setV(e.target.value)} aria-label="দৈনিক বাজেট" />
      <span>{currency}/দিন</span>
      {changed && <button disabled={pending}>{pending ? "..." : "সেভ"}</button>}
      {msg && <small className={msg === "✓" ? "adm-ok" : "adm-err"}>{msg}</small>}
    </form>
  );
}

export function RunRulesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <span className="courier-btn">
      <button
        type="button"
        className="adm-btn ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await adsRunRulesAction();
            setMsg(r.error ? r.error : r.paused.length ? `⏸ বন্ধ হয়েছে: ${r.paused.join(", ")}` : "✓ চেক হয়েছে — সব অ্যাড নিয়মের মধ্যে আছে (বা নিয়ম বন্ধ)");
            router.refresh();
          })
        }
      >
        {pending ? "চেক হচ্ছে..." : "🔍 এখনই নিয়ম চেক করুন"}
      </button>
      {msg && <small className={msg.startsWith("✓") ? "adm-ok" : "adm-err"}>{msg}</small>}
    </span>
  );
}
