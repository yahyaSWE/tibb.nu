import { appUrl } from "./stripe";

const liveKustomElements = {
  publicApiKey: "5c5d5254-d359-4223-a183-8286150dd3ff",
  scriptUrl: "https://js.live.kustom.co/kustom-elements/v1/pre-load.js",
};

export function shopPaymentProvider(): "stripe" | "kustom" {
  return process.env.NODE_ENV === "production" || process.env.SHOP_PAYMENT_PROVIDER === "kustom" ? "kustom" : "stripe";
}

export function getKustomElementsConfig() {
  if (shopPaymentProvider() !== "kustom") return null;

  const publicApiKey = process.env.KUSTOM_ELEMENTS_PUBLIC_API_KEY?.trim();
  const source = process.env.KUSTOM_ELEMENTS_SCRIPT_URL?.trim();
  if (!publicApiKey && !source && process.env.KUSTOM_ENVIRONMENT === "production") {
    return liveKustomElements;
  }

  const scriptUrl = URL.parse(source ?? "");
  if (!publicApiKey || scriptUrl?.protocol !== "https:" || !scriptUrl.hostname.endsWith(".kustom.co")) {
    return null;
  }

  return { publicApiKey, scriptUrl: scriptUrl.href };
}

export function kustomConfiguration() {
  const environment = process.env.KUSTOM_ENVIRONMENT || (process.env.VERCEL_ENV === "production" ? "production" : "playground");
  if (!["playground", "production"].includes(environment)) throw new Error("Invalid Kustom environment");
  if (!process.env.KUSTOM_API_USERNAME || !process.env.KUSTOM_API_PASSWORD) throw new Error("Kustom credentials missing");
  if (environment === "production" && process.env.KUSTOM_LIVE_ENABLED !== "1") throw new Error("Kustom live payments disabled");
  const origin = appUrl();
  if (!origin.startsWith("https:")) throw new Error("Kustom needs public HTTPS callbacks");
  return { environment: environment as "playground" | "production", origin,
    base: environment === "production" ? "https://api.kustom.co" : "https://api.playground.kustom.co",
    authorization: `Basic ${Buffer.from(`${process.env.KUSTOM_API_USERNAME}:${process.env.KUSTOM_API_PASSWORD}`).toString("base64")}` };
}
export function kustomReady() { try { kustomConfiguration(); return true; } catch { return false; } }

export function bookingVatPercent() {
  const value = process.env.KUSTOM_BOOKING_VAT_PERCENT ?? "25";
  return ["0", "6", "12", "25"].includes(value) ? Number(value) : null;
}

export function kustomBookingReady() {
  return kustomReady() && bookingVatPercent() !== null;
}
