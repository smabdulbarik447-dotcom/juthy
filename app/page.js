import { site, bn, tk } from "@/data/site";
import { getSettings, getProducts, deliveryOptions } from "@/lib/store";
import Gallery from "@/components/Gallery";
import Collection from "@/components/Collection";
import OrderForm from "@/components/OrderForm";
import Tracking from "@/components/Tracking";
import Brand from "@/components/Brand";

export async function generateMetadata() {
  const [s, products] = await Promise.all([getSettings(), getProducts()]);
  const price = products[0]?.price ?? site.price;
  return {
    ...(s.logo ? { icons: { icon: s.logo, apple: s.logo } } : {}),
    title: `সিগনেচার পারফিউম কম্বো — মাত্র ${price} টাকা | ${s.brand}`,
    description: "৪ ইন ১ সিগনেচার পারফিউম কম্বো + ১টি সিক্রেট ৬ মিলি আতর ফ্রি। সারা দেশে ক্যাশ অন ডেলিভারি।",
  };
}

export default async function Home() {
  const s = await getSettings();
  const products = await getProducts();
  const delivery = deliveryOptions(s);
  const main = products[0] || { price: site.price, old_price: site.oldPrice };
  const oldPrice = main.old_price || main.price;
  const save = oldPrice - main.price;
  const off = Math.round((save / oldPrice) * 100);
  // Mul product er chobi i upore boro kore dekhay, tarpor banner er chobi gulo
  const productImage = main.image || "/images/combo.png";
  const banners = s.gallery.split("\n").map((x) => x.trim()).filter(Boolean);
  const gallery = [productImage, ...banners.filter((src) => src !== productImage)];

  return (
    <>
      <Tracking pixel={s.fb_pixel} gtm={s.gtm_id} />
      <div className="topbar">
        <span>🔥 স্পেশাল অফার: ৪ ইন ১ সিগনেচার কম্বো মাত্র {bn(main.price)} টাকা + ১ টি সিক্রেট ৬ মিলি আতর সম্পূর্ণ ফ্রি!</span>
        <span className="topbar-cod">ক্যাশ অন ডেলিভারি (খুলে চেক করার সুবিধা)</span>
      </div>

      <header className="header">
        <div className="container header-inner">
          <Brand s={s} />
          <div className="header-actions">
            <a href={`tel:${s.phone}`} className="header-phone">📞 {s.phone}</a>
            <a href="#order" className="btn btn-sm">অর্ডার করুন</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="offer-strip">
            🔥 <b>অফার:</b> সিগনেচার কম্বো মাত্র {bn(main.price)} টাকায় + ১ টি সিক্রেট ৬ মিলি আতর ফ্রি!
            <span>সারা দেশে ক্যাশ অন ডেলিভারি</span>
          </div>

          <div className="hero-grid">
            <Gallery images={gallery} brand={s.brand} />

            <div className="hero-info">
              <span className="eyebrow">✨ PREMIUM COLLECTION</span>
              <h1>সিগনেচার পারফিউম কম্বো</h1>
              <p className="hero-sub">আপনার ব্যক্তিত্বকে ফুটিয়ে তুলতে একটি আদর্শ চয়েজ</p>
              <div className="rating">
                <span className="stars">★★★★★</span> <b>4.9 / 5.0</b> <small>(১,০০০+ ভেরিফাইড রিভিউ)</small>
              </div>

              <div className="features">
                {site.features.map((f) => (
                  <div key={f.title} className="feature">
                    <span className="feature-icon">{f.icon}</span>
                    <div>
                      <b>{f.title}</b>
                      <p>{f.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="price-card">
                <span className="price-label">অফার মূল্য:</span>
                <div className="price-row">
                  <span className="price-new">৳{tk(main.price)}</span>
                  <del>৳{tk(oldPrice)}</del>
                </div>
                <span className="save">{bn(save)} টাকা সাশ্রয় ({bn(off)}% ছাড়)</span>
              </div>

              <div className="gift-note">
                <img src="/images/gift.png" alt="Secret Perfume 6ml" />
                <div>
                  <b>🎁 সাথে পাচ্ছেন ১টি সিক্রেট 6 মিলি "Secret Perfume"</b>
                  <p>লং-লাস্টিং প্রিমিয়াম আতর সম্পূর্ণ ফ্রি!</p>
                </div>
              </div>

              <a href="#order" className="btn btn-block btn-lg">অর্ডার করতে এখানে ক্লিক করুন 👉</a>
              <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="btn-wa">💬 হোয়াটসঅ্যাপে অর্ডার</a>

              <div className="mini-info">
                <div><b>🚚 হোম ডেলিভারি</b><small>ঢাকা {bn(delivery[0].charge)}৳ / বাইরে {bn(delivery[1].charge)}৳</small></div>
                <div><b>💵 ক্যাশ অন ডেলিভারি</b><small>হাতে পেয়ে মূল্য পরিশোধ</small></div>
                <div><b>🎁 ফ্রি গিফট আতর</b><small>৬ মিলি সিক্রেট পারফিউম</small></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Collection */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">✨ এক্সক্লুসিভ কালেকশন</span>
            <h2>বেস্ট সেলিং <span className="grad">৪টি ইউনিক সুবাস</span></h2>
            <p>অফিস, মিটিং, ক্যাজুয়াল কিংবা নাইট পার্টি—যেকোনো মুহূর্তের জন্য ৪টি ভিন্ন মেজাজের মাস্টারপিস সুবাস</p>
          </div>
          <Collection />
        </div>
      </section>

      {/* Free gift */}
      <section className="section alt">
        <div className="container gift-grid">
          <div className="gift-img">
            <img src="/images/gift.png" alt="Secret Perfume 6ml" />
          </div>
          <div>
            <span className="eyebrow">🎁 ফ্রি বোনাস উপহার</span>
            <h2>সাথে আরো পাচ্ছেন ১ টি সিক্রেট 6 মিলি <span className="grad">"Secret Perfume"</span> সম্পূর্ণ ফ্রি!</h2>
            <p className="muted">৪টি ১৫ মিলি বোতলের সাথে ১টি স্পেশাল আতর ফ্রি দেওয়া হচ্ছে আপনার সুবাসের অভিজ্ঞতাকে পরিপূর্ণ করতে।</p>
            <a href="#order" className="btn">অফারটি লুফে নিন (৳{bn(main.price)})</a>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">⚖️ কেন আমরা সেরা</span>
            <h2>আসল পারফিউম বনাম <span className="grad">সাধারণের পার্থক্য</span></h2>
            <p>বাজারে সস্তা পারফিউমের ভিড়ে কেন এই সিগনেচার কম্বো আপনার ব্যক্তিত্বের জন্য একমাত্র সঠিক নির্বাচন?</p>
          </div>

          <div className="compare">
            <div className="compare-col good">
              <div className="compare-head">
                <img src="/images/hawas-ice.avif" alt="সিগনেচার কম্বো" />
                <div>
                  <small>১০০% আসল প্রিমিয়াম</small>
                  <h3>সিগনেচার কম্বো</h3>
                </div>
              </div>
              {site.pros.map((p) => (
                <div key={p.title} className="compare-item">
                  <span className="mark">✓</span>
                  <div><b>{p.title}</b><p>{p.text}</p></div>
                </div>
              ))}
              <div className="trust-pill">🛡️ ৯৮% রিপিট কাস্টমার ও সন্তুষ্ট গ্রাহকের আস্থা!</div>
            </div>

            <div className="compare-col bad">
              <div className="compare-head">
                <span className="bad-icon">❌</span>
                <div>
                  <small>বাজারের লোকাল কপি</small>
                  <h3>সাধারণ সস্তা পারফিউম</h3>
                </div>
              </div>
              {site.cons.map((c) => (
                <div key={c.title} className="compare-item">
                  <span className="mark">✕</span>
                  <div><b>{c.title}</b><p>{c.text}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div className="center">
            <a href="#order" className="btn btn-lg">আসল সিগনেচার কম্বো অর্ডার করুন 👉</a>
          </div>
        </div>
      </section>

      {/* Package */}
      <section className="section alt">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">✨ স্পেশাল অফার প্যাকেজ</span>
            <h2>এক্সক্লুসিভ <span className="grad">অফার প্যাকেজ</span></h2>
            <p>{s.brand} সিগনেচার কম্বো প্যাকের সাথে লুফে নিন আকর্ষণীয় ডিসকাউন্ট ও ফ্রি গিফট</p>
          </div>

          <div className="package-card">
            <div className="package-img">
              <img src={productImage} alt={`${s.brand} এক্সক্লুসিভ অফার প্যাকেজ`} />
            </div>
            <div className="package-body">
              <h3>{s.brand} সিগনেচার কম্বো প্যাক</h3>
              <p className="muted">৪ ইন ১ প্রিমিয়াম পারফিউম সেট (১৫ মিলি প্রতিটি)</p>
              <div className="price-row">
                <span className="price-new">৳{bn(main.price)}.০০</span>
                <del>৳{bn(oldPrice)}.০০</del>
              </div>
              <span className="save">{bn(save)} টাকা সাশ্রয় ({bn(off)}% ছাড়)</span>
              <ul className="checks">
                <li><b>৪টি প্রিমিয়াম EDP পারফিউম:</b> ভ্যাম্পায়ার ব্লাড, ডিওর সভেজ, হাওয়াস আইস ও হাওয়াস ফায়ার।</li>
                <li><b>মোট ৬০ মিলি কন্সেন্ট্রেটেড পারফিউম:</b> যা দেবে দীর্ঘ ৬-৭ ঘণ্টার স্থায়ী সুবাস।</li>
                <li><b>ক্যাশ অন ডেলিভারি:</b> সারা বাংলাদেশে ডেলিভারি ম্যানের সামনে প্যাকেট খুলে চেক করে নেওয়ার সুবিধা।</li>
              </ul>
              <div className="gift-line">🎁 সাথে পাচ্ছেন ১টি সিক্রেট ৬ মিলি "Secret Perfume" আতর সম্পূর্ণ ফ্রি!</div>
              <a href="#order" className="btn btn-block btn-lg">অর্ডার করতে এখানে ক্লিক করুন (৳{bn(main.price)}) 👉</a>
            </div>
          </div>
        </div>
      </section>

      {/* COD banner */}
      <section className="container">
        <div className="cod-banner">
          <h2>সারা বাংলাদেশে ক্যাশ অন ডেলিভারি!</h2>
          <p>পার্সেল হাতে পেয়ে দেখে দেখে মূল্য পরিশোধ করার সুবিধা।</p>
          <a href="#order" className="btn">অর্ডার করুন</a>
        </div>
      </section>

      {/* Order */}
      <section className="section" id="order">
        <div className="container">
          <div className="section-head">
            <h2>অর্ডার করতে আপনার তথ্য দিয়ে <span className="grad">নিচের ফরমটি পুরন করুন</span></h2>
          </div>
          <OrderForm products={products} delivery={delivery} />
        </div>
      </section>

      <footer className="footer">
        <Brand s={s} className="center-brand" />
        <p>যেকোনো প্রয়োজনে কল করুন: <a href={`tel:${s.phone}`}>{s.phone}</a></p>
        <small>© {new Date().getFullYear()} {s.brand}. All rights reserved.</small>
      </footer>

      <div className="sticky-bar">
        <a href={`https://wa.me/${s.whatsapp}`} className="sticky-wa" target="_blank" rel="noreferrer">💬</a>
        <a href="#order" className="btn">অর্ডার করুন ৳{bn(main.price)}</a>
      </div>
    </>
  );
}
