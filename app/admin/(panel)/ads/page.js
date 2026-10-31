import Link from "next/link";
import { ensureTables } from "@/lib/db";
import { getSettings } from "@/lib/store";
import { fbAdsReady, getCampaigns, ourCampaignOrders, PRESETS } from "@/lib/fbads";
import { saveAdsSetupAction, saveAdsRulesAction } from "../../actions";
import SaveForm from "../SaveForm";
import { AdToggle, BudgetEdit, RunRulesButton } from "./AdsControls";

const STATUS_TEXT = {
  ACTIVE: "চলছে", PAUSED: "বন্ধ", CAMPAIGN_PAUSED: "ক্যাম্পেইন বন্ধ", ADSET_PAUSED: "অ্যাড সেট বন্ধ",
  IN_PROCESS: "প্রসেসিং", WITH_ISSUES: "সমস্যা আছে", PENDING_REVIEW: "রিভিউতে", DISAPPROVED: "বাতিল (রিজেক্ট)",
};

export default async function AdsPage({ searchParams }) {
  const sp = await searchParams;
  const preset = PRESETS.some((p) => p.id === sp.p) ? sp.p : "today";
  await ensureTables();
  const s = await getSettings();
  const ready = fbAdsReady(s);

  let data = null;
  let ours = {};
  let error = "";
  if (ready) {
    try {
      data = await getCampaigns(s, preset);
      ours = await ourCampaignOrders(preset, data.campaigns);
    } catch (err) {
      error = err.message;
    }
  }
  const cur = data?.account.currency || "";
  const fmt = (n) => `${Number(n || 0).toFixed(2)} ${cur}`;
  const tot = (data?.campaigns || []).reduce(
    (t, c) => ({ spend: t.spend + c.stats.spend, p: t.p + c.stats.purchases, clicks: t.clicks + c.stats.clicks }),
    { spend: 0, p: 0, clicks: 0 },
  );
  const ourTot = Object.values(ours).reduce((t, o) => ({ orders: t.orders + o.orders, delivered: t.delivered + o.delivered, returned: t.returned + o.returned }), { orders: 0, delivered: 0, returned: 0 });
  const hasUtm = Object.keys(ours).length > 0;

  return (
    <>
      <h1 className="adm-title">Facebook অ্যাড</h1>

      {ready && !error && data && (
        <>
          <div className="ad-acc">
            <span>📣 <b>{data.account.name}</b> • {cur}</span>
            <span className={`pill ${data.account.active ? "st-delivered" : "st-cancelled"}`}>{data.account.active ? "✓ অ্যাকাউন্ট চালু" : "অ্যাকাউন্টে সমস্যা"}</span>
            <nav className="range-tabs">
              {PRESETS.map((p) => (
                <Link key={p.id} href={`/admin/ads?p=${p.id}`} className={p.id === preset ? "active" : ""}>{p.label}</Link>
              ))}
            </nav>
          </div>

          <section className="adm-cards fraud-cards ad-cards">
            <div className="adm-card"><span className="adm-icon red">💸</span><small>খরচ</small><b>{fmt(tot.spend)}</b></div>
            <div className="adm-card"><span className="adm-icon green">🛒</span><small>অর্ডার (Facebook বলছে)</small><b>{tot.p}</b></div>
            <div className="adm-card"><span className="adm-icon yellow">🎯</span><small>প্রতি অর্ডারে খরচ</small><b>{tot.p ? fmt(tot.spend / tot.p) : "—"}</b></div>
            <div className="adm-card">
              <span className="adm-icon blue">📦</span>
              <small>আমাদের হিসাব (লিংক থেকে)</small>
              <b>{hasUtm ? `${ourTot.orders} অর্ডার • ${ourTot.delivered} ডেলিভারড` : "—"}</b>
            </div>
          </section>

          <div className="ad-list">
            {data.campaigns.length === 0 && <p className="adm-muted">এই অ্যাকাউন্টে কোনো ক্যাম্পেইন নেই</p>}
            {data.campaigns.map((c) => {
              const o = ours[c.id];
              const cpa = c.stats.purchases ? c.stats.spend / c.stats.purchases : null;
              const bad = s.ads_max_cpa && c.stats.spend > 0 && (cpa === null ? c.stats.spend >= Number(s.ads_max_cpa) : cpa > Number(s.ads_max_cpa));
              return (
                <article key={c.id} className={`ad-card ${c.on ? "" : "off"}`}>
                  <header>
                    <AdToggle id={c.id} on={c.on} name={c.name} />
                    <div className="ad-name">
                      <b>{c.name}</b>
                      <small>{STATUS_TEXT[c.effective] || c.effective}</small>
                    </div>
                    {c.daily != null ? (
                      <BudgetEdit id={c.id} value={c.daily} currency={cur} />
                    ) : c.lifetime != null ? (
                      <span className="ad-life">লাইফটাইম বাজেট {fmt(c.lifetime)}</span>
                    ) : null}
                  </header>
                  <div className="ad-stats">
                    <div><small>খরচ</small><b>{fmt(c.stats.spend)}</b></div>
                    <div><small>অর্ডার</small><b>{c.stats.purchases}</b></div>
                    <div className={bad ? "warn" : ""}><small>প্রতি অর্ডার</small><b>{cpa === null ? "—" : fmt(cpa)}</b></div>
                    <div><small>লিংক ক্লিক</small><b>{c.stats.clicks}</b></div>
                    <div><small>CTR</small><b>{c.stats.ctr.toFixed(2)}%</b></div>
                    <div className="ours">
                      <small>আমাদের হিসাব</small>
                      <b>{o ? `${o.orders} অর্ডার • ${o.delivered}✓ ${o.returned}↩` : "—"}</b>
                    </div>
                  </div>
                  {c.daily == null && c.adsets.length > 0 && (
                    <ul className="ad-sets">
                      {c.adsets.map((a) => (
                        <li key={a.id}>
                          <AdToggle id={a.id} on={a.on} name={a.name} />
                          <span className="ad-set-name">{a.name}</span>
                          {a.daily != null ? <BudgetEdit id={a.id} value={a.daily} currency={cur} /> : a.lifetime != null ? <span className="ad-life">লাইফটাইম {fmt(a.lifetime)}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="adm-err adm-box">Facebook থেকে তথ্য আনা যায়নি: {error}</p>}

      <div className="adm-grid even">
        <div className="adm-box">
          <h3>⚙️ অটো নিয়ম ও রিপোর্ট</h3>
          <p className="adm-muted adm-intro-sm">
            আজ কোনো চালু ক্যাম্পেইনে খরচ <b>সর্বনিম্ন খরচ</b> ছাড়ালে আর প্রতি অর্ডারে খরচ <b>সর্বোচ্চ</b>-এর বেশি হলে (বা একটাও অর্ডার না এলে)
            ক্যাম্পেইন নিজে থেকে <b>বন্ধ</b> হবে আর Telegram এ জানাবে। নিয়ম শুধু বন্ধ করে — কখনো চালু করে না বা বাজেট বাড়ায় না।
            অ্যাডমিন খোলা থাকলে ৩০ মিনিটে একবার আর প্রতিদিন সন্ধ্যা ৬টায় চেক হয়।
          </p>
          <SaveForm action={saveAdsRulesAction}>
            <label>
              অটো বন্ধের নিয়ম
              <select name="ads_rule" defaultValue={s.ads_rule}>
                <option value="off">বন্ধ</option>
                <option value="on">✅ চালু</option>
              </select>
            </label>
            <div className="adm-row">
              <label>
                প্রতি অর্ডারে সর্বোচ্চ খরচ ({cur || "অ্যাকাউন্টের কারেন্সি"})
                <input name="ads_max_cpa" type="number" min="0" step="0.01" defaultValue={s.ads_max_cpa} placeholder="যেমন 2.5" />
              </label>
              <label>
                সর্বনিম্ন খরচ (এর আগে বিচার করবে না)
                <input name="ads_min_spend" type="number" min="0" step="0.01" defaultValue={s.ads_min_spend} placeholder="খালি = সর্বোচ্চ খরচের সমান" />
              </label>
            </div>
            <label>
              প্রতিদিন সন্ধ্যা ৬টায় Telegram এ অ্যাড রিপোর্ট
              <select name="ads_report" defaultValue={s.ads_report}>
                <option value="on">✅ চালু</option>
                <option value="off">বন্ধ</option>
              </select>
            </label>
          </SaveForm>
          {ready && <RunRulesButton />}
        </div>

        <div className="adm-box">
          <h3>🔑 Facebook কানেক্ট {ready ? <span className="pill st-delivered">✓ সেট করা</span> : <span className="pill st-pending">সেট করা নেই</span>}</h3>
          <ol className="ad-steps">
            <li><b>business.facebook.com</b> → Business Settings → <b>System Users</b> → Add (Admin)</li>
            <li>ওই ইউজার → <b>Assign Assets</b> → আপনার Ad Account → <b>Full control</b></li>
            <li><b>developers.facebook.com</b> → Create App (Business) → <b>Marketing API</b> যোগ করুন, অ্যাপটা Business এ যুক্ত করুন</li>
            <li>System User → <b>Generate token</b> → ওই অ্যাপ বাছুন → <b>ads_management</b> আর <b>ads_read</b> টিক → মেয়াদ “Never”</li>
            <li>টোকেন আর Ad Account ID (Ads Manager লিংকের <b>act=</b> এর পরের সংখ্যা) নিচে দিন</li>
          </ol>
          <SaveForm action={saveAdsSetupAction} button="সেভ ও কানেক্ট চেক করুন">
            <label>
              Ad Account ID
              <input name="fb_ad_account" defaultValue={s.fb_ad_account} placeholder="যেমন 1234567890" required />
            </label>
            <label>
              System User Token
              <input
                name="fb_ads_token"
                type="password"
                autoComplete="new-password"
                placeholder={s.fb_ads_token ? "•••••••• (সেভ করা আছে — বদলাতে নতুন দিন)" : "EAA..."}
                required={!s.fb_ads_token}
              />
            </label>
          </SaveForm>
        </div>
      </div>

      <div className="adm-box">
        <h3>📦 “আমাদের হিসাব” চালু করতে (কোন অ্যাড থেকে আসল অর্ডার/ডেলিভারি/রিটার্ন)</h3>
        <p className="adm-muted adm-intro-sm">
          প্রতিটি অ্যাডে Ads Manager → Ad → <b>Tracking → URL parameters</b> এ নিচের লাইনটা পেস্ট করুন। তাহলে কোন ক্যাম্পেইন থেকে
          কয়টা অর্ডার এসে <b>ডেলিভারড</b> হলো আর কয়টা <b>রিটার্ন</b> — সেটা এখানে দেখাবে (Facebook এর হিসাবের বাইরে আসল লাভ-ক্ষতি)।
        </p>
        <code className="webhook-url">utm_source={"{{site_source_name}}"}&amp;utm_medium={"{{placement}}"}&amp;utm_campaign={"{{campaign.id}}"}&amp;utm_content={"{{ad.id}}"}</code>
      </div>
    </>
  );
}
