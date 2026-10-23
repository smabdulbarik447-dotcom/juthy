"use client";

import { useState } from "react";
import { site } from "@/data/site";

export default function Collection() {
  const [index, setIndex] = useState(0);
  const p = site.perfumes[index];

  return (
    <>
      <div className="collection-grid">
        {site.perfumes.map((item, i) => (
          <button key={item.name} className={`ex-card ${i === index ? "active" : ""}`} onClick={() => setIndex(i)}>
            <div className="ex-img">
              <img src={item.image} alt={item.name} />
            </div>
            <span className="ex-badge">{item.badge}</span>
            <h3>{item.short}</h3>
            <small>15ml EDP</small>
          </button>
        ))}
      </div>

      <div className="spotlight">
        <div className="spot-img">
          <img key={p.image} src={p.image} alt={p.name} />
          <span className="spot-vol">15ml EDP • Concentrated EDP</span>
        </div>
        <div className="spot-body">
          <span className="pill">✨ {p.badge}</span>
          <h3>{p.name}</h3>
          <p className="spot-sub">{p.subtitle}</p>
          <p className="spot-desc">{p.description}</p>
          <h4>মুখ্য সুবাস নোটস:</h4>
          <div className="notes">
            {p.notes.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <h4>ব্যবহারের উপযুক্ত সময়:</h4>
          <p className="vibe">{p.vibe}</p>
          <a href="#order" className="btn">অর্ডার করুন 👉</a>
        </div>
      </div>
    </>
  );
}
