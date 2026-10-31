import { sql, ensureTables } from "@/lib/db";
import { getSettings } from "@/lib/store";
import { districtOf } from "@/lib/districts";

// Landing page er "এইমাত্র অর্ডার করেছেন" popup — shesh 3 diner asol order, shudhu prothom nam ar jela (number/thikana na)
export const revalidate = 60;

const PREFIX = /^(md\.?|mohammad|muhammad|mohammed|mst\.?|mrs\.?|mr\.?|sk\.?|মোঃ|মো:|মোহাম্মদ|মুহাম্মদ|মোসাঃ|মোছাঃ|মিসেস|শেখ)$/i;

export async function GET() {
  await ensureTables();
  const s = await getSettings();
  if (s.social_proof === "off") return Response.json({ orders: [] });
  const rows = await sql`
    SELECT name, product, address, area, created_at FROM orders
    WHERE status <> 'cancelled' AND created_at > now() - interval '3 days'
    ORDER BY created_at DESC LIMIT 15`;
  const orders = rows
    .map((o) => ({
      // "মোঃ রহিম" → "রহিম" (মোঃ/Md er moto shuru bad)
      name: String(o.name || "").trim().split(/\s+/).find((w) => !PREFIX.test(w)) || "",
      place: districtOf(o.address, o.area) || "",
      product: o.product,
      min: Math.round((Date.now() - new Date(o.created_at).getTime()) / 6e4),
    }))
    .filter((o) => o.name.length > 1 && o.name !== "—");
  return Response.json({ orders });
}
