import Script from "next/script";

export const GOOGLE_ANALYTICS_MEASUREMENT_ID = "G-HL70Z3V7Z7";
export const CLARITY_PROJECT_ID = "yl5tdfvwjh";

export const googleAnalyticsBootstrap = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GOOGLE_ANALYTICS_MEASUREMENT_ID}');
`;

export const clarityBootstrap = `
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
`;

// Every buy link goes through /out/<offerId>. Reporting the click here, not on the redirect,
// ties it to the visit's source, so a page's traffic can be judged by the purchases it sends.
// Clicks are captured on the document, so links rendered later are counted too.
export const outboundClickTracking = `
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href^="/out/"]') : null;
    if (!link) return;
    var offerId = link.getAttribute('href').slice(5).split(/[?#]/)[0];
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'outbound_click', { offer_id: offerId, page_path: location.pathname, transport_type: 'beacon' });
    }
    if (typeof window.clarity === 'function') window.clarity('event', 'outbound_click');
  }, true);
`;

export function AnalyticsTags() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {googleAnalyticsBootstrap}
      </Script>
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {clarityBootstrap}
      </Script>
      <Script id="outbound-click-tracking" strategy="afterInteractive">
        {outboundClickTracking}
      </Script>
    </>
  );
}
