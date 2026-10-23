import "../admin.css";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/store";
import { logoutAction } from "../actions";
import Sidebar from "./Sidebar";

export const metadata = { title: "Admin Panel", robots: { index: false } };

export default async function PanelLayout({ children }) {
  await requireAdmin();
  const s = await getSettings();
  const [first, ...rest] = s.brand.split(" ");

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-logo">
          {s.logo ? <img src={s.logo} alt={s.brand} className="adm-logo-img" /> : <b><span>{first}</span> {rest.join(" ")}</b>}
          <small>অ্যাডমিন প্যানেল</small>
        </div>
        <Sidebar />
        <div className="adm-side-foot">
          <a href="/" target="_blank">🌐 সাইট দেখুন</a>
          <form action={logoutAction}>
            <button>🚪 লগআউট</button>
          </form>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
