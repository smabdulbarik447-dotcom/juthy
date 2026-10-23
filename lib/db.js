import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL);

export const STATUSES = [
  { id: "pending", label: "পেন্ডিং" },
  { id: "confirmed", label: "কনফার্মড" },
  { id: "shipped", label: "শিপড" },
  { id: "delivered", label: "ডেলিভারড" },
  { id: "returned", label: "রিটার্ন" },
  { id: "cancelled", label: "বাতিল" },
];

// Order er kod: VL000012 er moto (brand er prothom 2 okkhor + id)
export const orderCode = (id, brand = "VL") =>
  brand.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() + String(id).padStart(6, "0");

let ready;
// Prothom bar call hole shob table toiri kore (alada migration lage na)
export function ensureTables() {
  ready ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id          BIGSERIAL PRIMARY KEY,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        name        TEXT NOT NULL,
        phone       TEXT NOT NULL,
        address     TEXT NOT NULL,
        product     TEXT NOT NULL DEFAULT '',
        area        TEXT NOT NULL DEFAULT '',
        qty         INT  NOT NULL DEFAULT 1,
        total       INT  NOT NULL DEFAULT 0,
        status      TEXT NOT NULL DEFAULT 'pending',
        note        TEXT NOT NULL DEFAULT ''
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id          BIGSERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        price       INT  NOT NULL,
        old_price   INT  NOT NULL DEFAULT 0,
        stock       INT  NOT NULL DEFAULT 100,
        image       TEXT NOT NULL DEFAULT '',
        sort        INT  NOT NULL DEFAULT 0,
        active      BOOLEAN NOT NULL DEFAULT true
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS incomplete_orders (
        phone       TEXT PRIMARY KEY,
        name        TEXT NOT NULL DEFAULT '',
        address     TEXT NOT NULL DEFAULT '',
        product     TEXT NOT NULL DEFAULT '',
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    // Fake order dhorar jonno: kon IP theke order eseche
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ip TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE incomplete_orders ADD COLUMN IF NOT EXISTS ip TEXT NOT NULL DEFAULT ''`;
    await sql`
      CREATE TABLE IF NOT EXISTS blocked (
        kind        TEXT NOT NULL,
        value       TEXT NOT NULL,
        reason      TEXT NOT NULL DEFAULT '',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (kind, value)
      )`;
    // Steadfast e pathano order er consignment, tracking ar courier status
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_status TEXT NOT NULL DEFAULT ''`;
    // Kon courier e geche: steadfast / pathao (purono gulo shob steadfast)
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier TEXT NOT NULL DEFAULT ''`;
    await sql`UPDATE orders SET courier = 'steadfast' WHERE courier_id <> '' AND courier = ''`;
    // Kon order er Telegram message kon chat e — status bodlale oi message edit hoy
    await sql`
      CREATE TABLE IF NOT EXISTS tg_messages (
        order_id    BIGINT NOT NULL,
        chat_id     TEXT NOT NULL,
        message_id  BIGINT NOT NULL,
        PRIMARY KEY (order_id, chat_id)
      )`;
  })().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}
