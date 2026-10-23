import { sql, ensureTables } from "@/lib/db";
import { getSettings } from "@/lib/store";
import { sfReady, sfKeyInvalid, getBalance } from "@/lib/steadfast";
import { pathaoReady, pathaoCredsSet, pathaoKeyInvalid, getPathaoStores } from "@/lib/pathao";
import { COURIERS, readyCouriers } from "@/lib/courier";
import { saveCourierAction, savePathaoAction, saveDefaultCourier } from "../../actions";
import SaveForm from "../SaveForm";
import { BulkSendButton, SyncButton } from "./CourierButtons";

export default async function CourierPage() {
  await ensureTables();
  const s = await getSettings();
  const ready = readyCouriers(s);

  // Steadfast obostha
  let sfBalance = null;
  let sfError = "";
  if (sfKeyInvalid(s)) {
    sfError = "API Key ভুল ছিল — সঠিক Key দিয়ে আবার সেভ করুন (ভুল Key দিয়ে বারবার চেষ্টা করলে Steadfast অ্যাকাউন্ট লক করতে পারে)";
  } else if (sfReady(s)) {
    try {
      sfBalance = await getBalance(s);
    } catch (err) {
      sfError = err.message;
    }
  }

  // Pathao obostha + store list
  let stores = [];
  let ptError = "";
  if (pathaoKeyInvalid(s)) {
    ptError = "লগইন তথ্য ভুল ছিল — সঠিক তথ্য দিয়ে আবার সেভ করুন";
  } else if (pathaoCredsSet(s)) {
    try {
      stores = await getPathaoStores(s);
    } catch (err) {
      ptError = err.message;
    }
  }

  const [counts] = await sql`
    SELECT count(*) FILTER (WHERE status = 'confirmed' AND courier_id = '')::int AS waiting,
           count(*) FILTER (WHERE status = 'shipped' AND courier_id <> '')::int AS on_way
    FROM orders`;

  const badge = (ok, err) =>
    err ? <span className="pill st-cancelled">সমস্যা</span> : ok ? <span className="pill st-delivered">✓ চালু</span> : <span className="pill st-pending">সেট করা নেই</span>;

  return (
    <>
      <h1 className="adm-title">কুরিয়ার</h1>

      <section className="adm-cards fraud-cards">
        <div className="adm-card">
          <span className="adm-icon green">🚚</span>
          <small>চালু কুরিয়ার</small>
          <b>{ready.length ? ready.map((c) => COURIERS[c].name).join(", ") : "কোনোটা না"}</b>
        </div>
        <div className="adm-card">
          <span className="adm-icon yellow">📦</span>
          <small>পাঠানোর অপেক্ষায় (কনফার্মড)</small>
          <b>{counts.waiting}</b>
        </div>
        <div className="adm-card">
          <span className="adm-icon blue">🛣️</span>
          <small>কুরিয়ারে পথে আছে</small>
          <b>{counts.on_way}</b>
        </div>
      </section>

      <div className="adm-box">
        <h3>⚡ এক ক্লিকে কাজ</h3>
        <div className="courier-bulk">
          <SaveForm action={saveDefaultCourier} button="সেভ">
            <label>
              ডিফল্ট কুরিয়ার (অটো এন্ট্রি আর “সব কনফার্মড পাঠান” এখানে যাবে)
              <select name="default_courier" defaultValue={s.default_courier}>
                {Object.values(COURIERS).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name} {ready.includes(c.id) ? "" : "(সেট করা নেই)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              অর্ডার কনফার্ম করলে কুরিয়ারে অটো এন্ট্রি
              <select name="auto_courier" defaultValue={s.auto_courier}>
                <option value="on">✅ চালু — কনফার্ম করলেই কুরিয়ারে চলে যাবে</option>
                <option value="off">বন্ধ — নিজে বাটন চেপে পাঠাবো</option>
              </select>
            </label>
          </SaveForm>
          <div className="courier-actions">
            <BulkSendButton
              waiting={counts.waiting}
              courier={s.default_courier}
              name={COURIERS[s.default_courier]?.name}
              disabled={!ready.includes(s.default_courier)}
            />
            <SyncButton onWay={counts.on_way} disabled={!ready.length} />
          </div>
        </div>
        <ul className="fraud-always">
          <li>⚡ <b>অটো এন্ট্রি:</b> কল করে অর্ডার <b>কনফার্ম</b> করলেই (অ্যাডমিন বা Telegram থেকে) ডিফল্ট কুরিয়ারে এন্ট্রি হয়ে যায় — <b>বাতিল</b> করলে কিছুই হয় না। ডিফল্টটা চালু না থাকলে অন্য চালু কুরিয়ারে যায়।</li>
          <li>📦 অর্ডার পেজে আর Telegram এ প্রতিটি অর্ডারে চালু কুরিয়ারগুলোর বাটন — চাপলেই এন্ট্রি হয়ে যাবে</li>
          <li>🚚 পাঠানোর পর অর্ডার নিজে থেকে <b>শিপড</b> হয়, ট্র্যাকিং লিংক সেভ থাকে</li>
          <li>💰 COD = অর্ডারের মোট টাকা (ডেলিভারি চার্জসহ)</li>
          <li>🔄 প্রতিদিন সন্ধ্যা ৬টায় দুই কুরিয়ারের স্ট্যাটাস নিজে থেকে চেক হয় — ডেলিভারড/রিটার্ন হলে অর্ডারও আপডেট হয়</li>
        </ul>
      </div>

      <div className="adm-grid even">
        <div className="adm-box">
          <h3>📮 Steadfast {badge(sfReady(s), sfError)}</h3>
          {sfBalance !== null && <p className="adm-muted">ব্যালেন্স: <b>৳{Number(sfBalance).toLocaleString("en-IN")}</b></p>}
          {sfError && <p className="adm-err">{sfError}</p>}
          <p className="adm-muted adm-intro-sm">
            Steadfast মার্চেন্ট প্যানেলে লগইন করে API অপশন থেকে <b>API Key</b> আর <b>Secret Key</b> কপি করে দিন।
          </p>
          <SaveForm action={saveCourierAction} button="সেভ ও কানেক্ট চেক করুন">
            <label>
              API Key
              <input name="steadfast_api_key" defaultValue={s.steadfast_api_key} autoComplete="off" required />
            </label>
            <label>
              Secret Key
              <input
                name="steadfast_secret_key"
                type="password"
                autoComplete="new-password"
                placeholder={s.steadfast_secret_key ? "•••••••• (সেভ করা আছে — বদলাতে নতুন দিন)" : "Secret Key দিন"}
                required={!s.steadfast_secret_key}
              />
            </label>
          </SaveForm>
        </div>

        <div className="adm-box">
          <h3>🛵 Pathao {badge(pathaoReady(s), ptError)}</h3>
          {pathaoReady(s) && !ptError && <p className="adm-muted">স্টোর: <b>{s.pathao_store_name || s.pathao_store_id}</b></p>}
          {ptError && <p className="adm-err">{ptError}</p>}
          <p className="adm-muted adm-intro-sm">
            Pathao মার্চেন্ট প্যানেল → <b>Developer API</b> থেকে <b>Client ID</b> আর <b>Client Secret</b> নিন।
            ইমেইল/পাসওয়ার্ড = আপনার Pathao মার্চেন্ট লগইন।
          </p>
          <SaveForm action={savePathaoAction} button="সেভ ও কানেক্ট চেক করুন">
            <div className="adm-row">
              <label>
                Client ID
                <input name="pathao_client_id" defaultValue={s.pathao_client_id} autoComplete="off" required />
              </label>
              <label>
                Client Secret
                <input
                  name="pathao_client_secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={s.pathao_client_secret ? "•••••••• (সেভ করা আছে)" : "Client Secret"}
                  required={!s.pathao_client_secret}
                />
              </label>
            </div>
            <div className="adm-row">
              <label>
                Pathao লগইন ইমেইল
                <input name="pathao_username" type="email" defaultValue={s.pathao_username} autoComplete="off" required />
              </label>
              <label>
                Pathao পাসওয়ার্ড
                <input
                  name="pathao_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={s.pathao_password ? "•••••••• (সেভ করা আছে)" : "পাসওয়ার্ড"}
                  required={!s.pathao_password}
                />
              </label>
            </div>
            {stores.length > 0 && (
              <label>
                পিকআপ স্টোর
                <select name="pathao_store_id" defaultValue={s.pathao_store_id}>
                  {stores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} — {st.address}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </SaveForm>
        </div>
      </div>
    </>
  );
}
