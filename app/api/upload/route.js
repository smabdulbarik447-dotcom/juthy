import { isAdmin } from "@/lib/auth";
import { sql, ensureTables } from "@/lib/db";

const MAX = 4 * 1024 * 1024;

// Admin panel theke chobi upload — browser age chobi choto (webp) kore pathay
export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return Response.json({ error: "কোনো ফাইল পাওয়া যায়নি" }, { status: 400 });
  // "voice" folder e shudhu audio, baki shob jaygay shudhu chobi
  const folder = ["banners", "logo", "voice"].includes(form.get("folder")) ? form.get("folder") : "products";
  const isVoice = folder === "voice";
  if (isVoice ? !file.type.startsWith("audio/") : !file.type.startsWith("image/")) {
    return Response.json({ error: isVoice ? "শুধু অডিও ফাইল (MP3) আপলোড করা যাবে" : "শুধু ছবি আপলোড করা যাবে" }, { status: 400 });
  }
  if (file.size > MAX) return Response.json({ error: "ফাইল ৪ MB এর বেশি" }, { status: 400 });

  const ext = (file.type.split("/")[1] || "bin").replace("jpeg", "jpg").replace("mpeg", "mp3").replace("x-m4a", "m4a");
  try {
    await ensureTables();
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const [row] = await sql`INSERT INTO media (type, data) VALUES (${file.type}, ${data}) RETURNING id`;
    return Response.json({ url: `/api/media/${row.id}.${ext}` });
  } catch (err) {
    console.error("Upload failed", err);
    return Response.json({ error: "আপলোড হয়নি, আবার চেষ্টা করুন" }, { status: 500 });
  }
}
