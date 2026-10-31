import { del } from "@vercel/blob";
import { sql } from "./db";

// Shudhu amader upload kora file muche — /images/... (project er nijer chobi) ke hat dey na
const isBlob = (url) => /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url || "");
const mediaId = (url) => Number(/^\/api\/media\/(\d+)/.exec(url || "")?.[1]) || null;

export async function deleteImages(urls) {
  const ids = urls.map(mediaId).filter(Boolean);
  if (ids.length) await sql`DELETE FROM media WHERE id = ANY(${ids})`.catch((err) => console.error("Media delete failed", err));
  const list = urls.filter(isBlob);
  if (!list.length) return;
  try {
    await del(list);
  } catch (err) {
    console.error("Image delete failed", err);
  }
}
