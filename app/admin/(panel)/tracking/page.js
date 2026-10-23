import { getSettings } from "@/lib/store";
import { saveSettingsAction } from "../../actions";
import SaveForm from "../SaveForm";

export default async function TrackingPage() {
  const s = await getSettings();

  return (
    <>
      <h1 className="adm-title">ট্র্যাকিং কোড (Pixel/GTM)</h1>
      <p className="adm-muted adm-intro">
        শুধু আইডি দিন, পুরো কোড লাগবে না। Pixel দিলে PageView, ViewContent আর অর্ডার হলে Purchase (মূল্যসহ) ইভেন্ট নিজে থেকে যাবে।
      </p>

      <div className="adm-box adm-narrow">
        <SaveForm action={saveSettingsAction}>
          <label>
            Facebook Pixel ID
            <input name="fb_pixel" defaultValue={s.fb_pixel} inputMode="numeric" pattern="\d{5,20}" placeholder="যেমন: 1234567890123456" />
          </label>
          <label>
            Google Tag Manager ID
            <input name="gtm_id" defaultValue={s.gtm_id} pattern="[Gg][Tt][Mm]-[A-Za-z0-9]{4,12}" placeholder="যেমন: GTM-ABC1234" />
          </label>
        </SaveForm>
      </div>
    </>
  );
}
