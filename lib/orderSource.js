// Order kon platform theke: ad link er utm (site_source_name / placement), na thakle Facebook/Instagram app er browser (user agent)
const PLATFORMS = {
  fb: { icon: "📘", label: "Facebook" },
  ig: { icon: "📸", label: "Instagram" },
  msg: { icon: "💬", label: "Messenger" },
  an: { icon: "📱", label: "অন্য অ্যাপ (Audience Network)" },
  tiktok: { icon: "🎵", label: "TikTok" },
  google: { icon: "🔎", label: "Google" },
  direct: { icon: "🌐", label: "সরাসরি / অন্যান্য" },
  call: { icon: "📞", label: "কল / হাতে বসানো" },
};

// {{placement}} jemon "Facebook_Mobile_Reels", "Instagram_Stories", "Facebook_Mobile_Feed"
function placementOf(p) {
  const v = String(p || "").toLowerCase();
  if (!v) return "";
  if (v.includes("reel")) return "রিলস";
  if (v.includes("stor")) return "স্টোরি";
  if (v.includes("marketplace")) return "মার্কেটপ্লেস";
  if (v.includes("explore")) return "এক্সপ্লোর";
  if (v.includes("search")) return "সার্চ";
  if (v.includes("inbox") || v.includes("messenger")) return "ইনবক্স";
  if (v.includes("instream") || v.includes("video")) return "ভিডিও";
  if (v.includes("right_column")) return "ডান কলাম";
  if (v.includes("feed")) return "নিউজফিড";
  return "";
}

export function orderSource(o) {
  const url = String(o.page_url || "");
  let q;
  try {
    q = new URL(url).searchParams;
  } catch {
    q = new URLSearchParams(url.split("?")[1] || "");
  }
  const src = (q.get("utm_source") || "").toLowerCase();
  const medium = q.get("utm_medium") || "";
  const ua = String(o.user_agent || "");
  let id;
  if (!ua && !url) id = "call";
  else if (/^(ig|instagram)$/.test(src)) id = "ig";
  else if (/^(msg|messenger)$/.test(src)) id = "msg";
  else if (src === "an") id = "an";
  else if (/^(fb|facebook)$/.test(src)) id = "fb";
  else if (/^tiktok$/.test(src) || q.has("ttclid")) id = "tiktok";
  else if (/^google$/.test(src) || q.has("gclid")) id = "google";
  // Link e utm na thakle: kon app er bhitorer browser theke kholа hoyechhe
  else if (/Instagram/i.test(ua)) id = "ig";
  else if (/FBAN\/Messenger|MessengerForiOS|MessengerLite/i.test(ua)) id = "msg";
  else if (/FBAN|FBAV|FB_IAB|FB4A/i.test(ua) || o.fbc || q.has("fbclid")) id = "fb";
  else id = "direct";
  return {
    id,
    ...PLATFORMS[id],
    place: placementOf(medium),
    // utm_campaign thakle ad theke (shudhu fbclid post-er link click o hote pare)
    ad: Boolean(q.get("utm_campaign")),
  };
}
