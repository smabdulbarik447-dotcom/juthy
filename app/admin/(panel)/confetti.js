// Rongin kagoj er brishti — kono library charai, kichu DOM tukro CSS animation diye pore
const COLORS = ["#f59e0b", "#ec4899", "#8b5cf6", "#10b981", "#3b82f6", "#ef4444", "#facc15"];

export function confetti(n = 120) {
  if (typeof document === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "confetti";
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 260}px`);
    p.style.setProperty("--r", `${(Math.random() - 0.5) * 1440}deg`);
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    if (i % 3 === 0) p.style.borderRadius = "50%";
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4600);
}

// Choto "ting-ting" shobdo (WebAudio) — file lage na; browser shobdo atkale chupchap bad
export function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1318.5, 1760].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.5);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {}
}
