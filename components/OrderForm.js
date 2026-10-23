"use client";

import { useRef, useState } from "react";
import { tk } from "@/data/site";

export default function OrderForm({ products, delivery }) {
  // Ek bare ektai variant select thake
  const [pkg, setPkg] = useState(products[0]?.id);
  const [qty, setQty] = useState(() => Object.fromEntries(products.map((p) => [p.id, 1])));
  const [area, setArea] = useState(delivery[0].id);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const formRef = useRef(null);
  const savedDraft = useRef("");

  const items = products.filter((p) => p.id === pkg);
  const count = items.reduce((n, p) => n + qty[p.id], 0);
  // 1 tar beshi nile, ba "ফ্রি ডেলিভারি" deya variant nile delivery free
  const freeShip = count > 1 || items.some((p) => p.free_delivery);
  const charge = freeShip ? 0 : delivery.find((d) => d.id === area).charge;
  const subtotal = items.reduce((t, p) => t + p.price * qty[p.id], 0);
  const total = subtotal + charge;

  const changeQty = (id, diff) => {
    setPkg(id);
    setQty((q) => ({ ...q, [id]: Math.max(1, q[id] + diff) }));
  };

  // Customer phone number likhe order na korle "অসম্পূর্ণ অর্ডার" e save hoy
  function saveDraft() {
    const form = new FormData(formRef.current);
    const phone = String(form.get("phone") || "").trim();
    if (!/^01[3-9]\d{8}$/.test(phone)) return;
    const draft = { phone, website: form.get("website"), name: form.get("name"), address: form.get("address"), product: items.map((p) => p.name).join(", ") };
    const key = JSON.stringify(draft);
    if (key === savedDraft.current) return;
    savedDraft.current = key;
    fetch("/api/incomplete", { method: "POST", headers: { "Content-Type": "application/json" }, body: key }).catch(() => {});
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const phone = String(form.get("phone")).trim();
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      setError("সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন");
      return;
    }
    setError("");
    setStatus("loading");
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: form.get("website"),
          name: form.get("name"),
          phone,
          address: form.get("address"),
          items: items.map((p) => ({ productId: p.id, qty: qty[p.id] })),
          area,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      window.fbq?.("track", "Purchase", { value: total, currency: "BDT" });
      window.dataLayer?.push({ event: "purchase", value: total, currency: "BDT" });
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(err.message || "অর্ডার পাঠানো যায়নি, আবার চেষ্টা করুন বা কল করুন");
    }
  }

  if (!products.length) return <p className="checkout">এই মুহূর্তে কোনো পণ্য পাওয়া যাচ্ছে না।</p>;

  if (status === "done") {
    return (
      <div className="checkout success">
        <div className="success-icon">✓</div>
        <h3>ধন্যবাদ! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে</h3>
        <p>আমাদের প্রতিনিধি খুব শীঘ্রই আপনাকে কল করে অর্ডার কনফার্ম করবেন।</p>
        <p className="success-total">Total: ৳ {tk(total)}</p>
      </div>
    );
  }

  return (
    <form className="checkout" onSubmit={onSubmit} ref={formRef} onBlur={saveDraft}>
      {/* Bot dhorar fad: manush eta dekhe na, bot puron kore */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp-field" aria-hidden="true" />
      <h3 className="form-head">পছন্দের ফ্লেভার কম্বো সিলেক্ট করুন</h3>
      <div className="packages">
        {products.map((p) => (
          <label key={p.id} className={`package ${pkg === p.id ? "active" : ""}`}>
            <input type="radio" name="pkg" checked={pkg === p.id} onChange={() => setPkg(p.id)} />
            {p.image && <img src={p.image} alt="" />}
            <div className="package-info">
              <span>{p.name}</span>
              <div className="qty">
                <button type="button" onClick={() => changeQty(p.id, -1)} aria-label="কমান">−</button>
                <span>{qty[p.id]}</span>
                <button type="button" onClick={() => changeQty(p.id, 1)} aria-label="বাড়ান">+</button>
              </div>
            </div>
            <b>৳ {tk(p.price)}</b>
          </label>
        ))}
      </div>

      <div className="checkout-grid">
        <div className="billing">
          <h3>Billing details</h3>
          <label>
            আপনার নাম <i>*</i>
            <input name="name" required placeholder="আপনার নাম" />
          </label>
          <label>
            আপনার ঠিকানা <i>*</i>
            <input name="address" required placeholder="বাসা/রোড, থানা, জেলা" />
          </label>
          <label>
            মোবাইল নাম্বার <i>*</i>
            <input name="phone" required inputMode="numeric" maxLength={11} placeholder="01XXXXXXXXX" />
          </label>
          <h3 className="ship-head">Shipping</h3>
          {delivery.map((d) => (
            <label key={d.id} className={`radio ${area === d.id ? "active" : ""}`}>
              <input type="radio" name="area" checked={area === d.id} onChange={() => setArea(d.id)} />
              <span>{d.label}: </span>
              <b>{freeShip ? <><s>৳ {tk(d.charge)}</s> ফ্রি</> : `৳ ${tk(d.charge)}`}</b>
            </label>
          ))}
          <p className="free-ship">🎁 ২টি বা তার বেশি নিলে ডেলিভারি চার্জ ফ্রি!</p>
        </div>

        <div className="your-order">
          <h3>Your order</h3>
          <div className="row head"><span>Product</span><span>Subtotal</span></div>
          {items.map((p) => (
            <div className="row" key={p.id}>
              <span>{p.name} × {qty[p.id]}</span>
              <span>৳ {tk(p.price * qty[p.id])}</span>
            </div>
          ))}
          <div className="row"><span>Subtotal</span><span>৳ {tk(subtotal)}</span></div>
          <div className="row"><span>Shipment</span><span>{freeShip ? "ফ্রি" : `৳ ${tk(charge)}`}</span></div>
          <div className="row total"><span>Total</span><span>৳ {tk(total)}</span></div>

          <div className="cod-box">
            <label className="radio active">
              <input type="radio" checked readOnly />
              <span>ক্যাশ অন ডেলিভারি</span>
            </label>
            <p className="hadith">
              রাসুল (সা.) বলেছেন : যদি কোনো ব্যক্তি পণ্য কেনার উদ্দেশ্য ছাড়াই ক্রেতা সেজে বিক্রেতাকে বিপদে ফেলার জন্য পরিস্থিতি তৈরি করে। এটি বিক্রেতা বা সাধারণ ক্রেতা উভয়ের জন্যই ক্ষতিকর। (সহীহ বুখারী : ২১৪০)
            </p>
          </div>
          <p className="privacy">
            Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our privacy policy.
          </p>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-block" disabled={status === "loading"}>
            {status === "loading" ? "অপেক্ষা করুন..." : `অর্ডার করুন  ৳ ${tk(total)}`}
          </button>
        </div>
      </div>
    </form>
  );
}
