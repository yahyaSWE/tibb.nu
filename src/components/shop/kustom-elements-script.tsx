import Script from "next/script";

// Kustom's preload script uses this queue before the Elements SDK is ready.
const bootstrap = `
  (() => {
    const elements = window.kustomElements ??= (method, ...args) =>
      new Promise((resolve, reject) => {
        elements._internal.q.push({ method, args, resolve, reject });
      });
    const internal = elements._internal ??= { q: [], snippetVersion: "1.0.1" };
    elements.load ??= new Promise((resolve, reject) => {
      internal.loadResolve = resolve;
      internal.loadReject = reject;
    });
  })();
`;

export function KustomElementsScript({
  scriptUrl,
  publicApiKey,
}: {
  scriptUrl: string;
  publicApiKey: string;
}) {
  return (
    <>
      <Script id="kustom-elements-bootstrap" strategy="beforeInteractive">
        {bootstrap}
      </Script>
      <Script
        id="kustom-elements-script"
        src={scriptUrl}
        data-public-api-key={publicApiKey}
      />
    </>
  );
}
