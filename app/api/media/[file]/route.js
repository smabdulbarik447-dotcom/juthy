import { sql, ensureTables } from "@/lib/db";

// Upload kora chobi/voice dekhano — ekbar ana hole Vercel CDN o browser e bochhor dhore thake (file kokhono bodlay na, notun upload = notun id)
export async function GET(_req, { params }) {
  const id = Number(/^(\d+)/.exec((await params).file)?.[1]);
  if (!id) return new Response("Not found", { status: 404 });
  await ensureTables();
  const [m] = await sql`SELECT type, data FROM media WHERE id = ${id}`;
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m.data, "base64"), {
    headers: {
      "Content-Type": m.type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
