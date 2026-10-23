import { sql, ensureTables, STATUSES, orderCode } from "@/lib/db";
import { getSettings } from "@/lib/store";
import { COURIERS, readyCouriers, trackingLink, courierName, courierIcon } from "@/lib/courier";
import OrdersTable from "./OrdersTable";

export default async function OrdersPage({ searchParams }) {
  const { status } = await searchParams;
  await ensureTables();
  const [orders, settings, blocked] = await Promise.all([
    sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 5000`,
    getSettings(),
    sql`SELECT kind, value FROM blocked`,
  ]);

  // Protita phone er ager order er hishab — beshi বাতিল/রিটার্ন mane jhuki
  const history = {};
  for (const o of orders) {
    const h = (history[o.phone] ??= { total: 0, bad: 0, delivered: 0 });
    h.total++;
    if (o.status === "cancelled" || o.status === "returned") h.bad++;
    if (o.status === "delivered") h.delivered++;
  }
  const blockedSet = new Set(blocked.map((b) => `${b.kind}:${b.value}`));

  return (
    <>
      <h1 className="adm-title">অর্ডার</h1>
      <OrdersTable
        key={status || "all"}
        statuses={STATUSES}
        initialFilter={STATUSES.some((s) => s.id === status) ? status : "all"}
        couriers={readyCouriers(settings).map((id) => COURIERS[id])}
        orders={orders.map((o) => ({
          ...o,
          id: Number(o.id),
          code: orderCode(o.id, settings.brand),
          track: trackingLink(o),
          courier_name: courierName(o),
          courier_icon: courierIcon(o),
          created_at: new Date(o.created_at).toISOString(),
          history: history[o.phone],
          blocked: blockedSet.has(`phone:${o.phone}`) || (o.ip && blockedSet.has(`ip:${o.ip}`)),
        }))}
      />
    </>
  );
}
