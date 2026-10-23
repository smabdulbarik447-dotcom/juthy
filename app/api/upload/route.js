import { put } from "@vercel/blob";
import { isAdmin } from "@/lib/auth";

const MAX = 4 * 1024 * 1024;

// Admin panel theke chobi upload — browser age chobi choto (webp) kore pathay
export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return Response.json({ error: "কোনো ছবি পাওয়া যায়নি" }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "শুধু ছবি আপলোড করা যাবে" }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "ছবি ৪ MB এর বেশি" }, { status: 400 });

  const folder = ["banners", "logo"].includes(form.get("folder")) ? form.get("folder") : "products";
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  try {
    const blob = await put(`${folder}/image.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return Response.json({ url: blob.url });
  } catch (err) {
    console.error("Upload failed", err);
    return Response.json({ error: "আপলোড হয়নি, আবার চেষ্টা করুন" }, { status: 500 });
  }
}
