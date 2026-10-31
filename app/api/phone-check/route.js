import { ensureTables } from "@/lib/db";
import { getSettings } from "@/lib/store";
import { after } from "next/server";
import { bdcKey, checkPhoneSafe, alertLowRating } from "@/lib/bdcourier";

// Form e number boshalei: courier rating kom kina (order er age-i) — rating er shonkha bahire dei na, shudhu atkabe kina
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const phone = String(body?.phone || "");
  if (!/^01[3-9]\d{8}$/.test(phone)) return Response.json({ ok: false }, { status: 400 });

  await ensureTables();
  const settings = await getSettings();
  if (settings.bdc_guard !== "on" || !bdcKey(settings)) return Response.json({ ok: true });

  const min = Math.min(100, Math.max(1, Number(settings.bdc_guard_min) || 65));
  const h = await checkPhoneSafe(phone, { timeoutMs: 8000 });
  if (h?.total > 0 && h.rate < min) {
    after(() => alertLowRating(phone, h, { name: body.name, address: body.address }));
    return Response.json({ ok: false, blocked: "low_rating", phone: settings.phone, whatsapp: settings.whatsapp });
  }
  return Response.json({ ok: true });
}
