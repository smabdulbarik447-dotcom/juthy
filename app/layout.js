import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Signature Perfume Combo",
};

const IMG_FALLBACK =
  "document.addEventListener('error',function(e){var i=e.target;if(!i||i.tagName!=='IMG'||i.dataset.fb)return;" +
  "if(!/blob\\.vercel-storage\\.com/.test(i.currentSrc||i.src))return;i.dataset.fb='1';" +
  "if(i.classList.contains('brand-logo')){var t=document.createElement('b');t.className='brand-text';t.textContent=i.alt||'';i.replaceWith(t);return}" +
  "var th=i.closest('.gallery-thumbs button');if(th){th.style.display='none';return}" +
  "if(i.closest('.gallery,.package-img,.packages,.spot-img,.ex-card')){i.removeAttribute('srcset');i.src='/images/combo.png';return}" +
  "i.style.display='none'},true);";

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Upload kora chobi (Vercel Blob) load na hole bhanga chobi na dekhiye: pondo/gallery te mul chobi, logo r jaygay brand er nam, baki lukano */}
        <script dangerouslySetInnerHTML={{ __html: IMG_FALLBACK }} />
        {children}
        {/* Vercel Web Analytics — koto visitor, kon page, kon desh/device */}
        <Analytics />
      </body>
    </html>
  );
}
