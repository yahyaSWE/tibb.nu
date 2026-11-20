import { z } from "zod";

export class EmailConfigurationError extends Error {}
export class EmailDeliveryError extends Error {}
function senderAddress() {
  const raw = process.env.EMAIL_FROM?.trim() || "";
  if (/[\r\n]/.test(raw)) return null;
  const match = raw.match(/^[^<>\r\n]{1,100} <([^<>\s]+@[^<>\s]+)>$/);
  const address = match ? match[1] : raw;
  return z.email().safeParse(address).success ? raw : null;
}
export function emailAppUrl(): string {
  const url = new URL(process.env.APP_URL || "");
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:")))
    throw new EmailConfigurationError("APP_URL måste vara hemsidans betrodda HTTPS-adress.");
  return url.origin;
}
export function emailConfigurationStatus(): { configured: boolean; reason: string | null } {
  if (!process.env.RESEND_API_KEY?.trim())
    return { configured: false, reason: "E-post är inte ansluten. Lägg till RESEND_API_KEY på servern." };
  if (!senderAddress())
    return { configured: false, reason: "EMAIL_FROM måste vara en fullständig e-postadress på en domän som är verifierad i Resend, till exempel Tibb.nu <utskick@tibb.nu>." };
  try { emailAppUrl(); }
  catch { return { configured: false, reason: "E-post kräver en giltig APP_URL till hemsidans betrodda HTTPS-adress." }; }
  return { configured: true, reason: null };
}
export function requireEmailConfiguration() {
  const status = emailConfigurationStatus();
  if (!status.configured) throw new EmailConfigurationError(status.reason!);
  return { from: senderAddress()!, origin: emailAppUrl() };
}
export async function sendEmail(input: { to: string; subject: string; text: string; html?: string | null; idempotencyKey: string; from?: string; attachments?: { filename: string; content: string }[] }) {
  const config = requireEmailConfiguration();
  z.email().parse(input.to);
  if (!input.idempotencyKey || input.idempotencyKey.length > 256 || /[\r\n]/.test(input.subject))
    throw new EmailDeliveryError("E-postbegäran är ogiltig.");
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({ from: input.from || config.from, to: [input.to], subject: input.subject, text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}) }),
    });
  } catch { throw new EmailDeliveryError("E-posttjänsten svarar inte. Försök igen om en stund."); }
  if (!response.ok) throw new EmailDeliveryError("E-posttjänsten kunde inte acceptera meddelandet. Kontrollera anslutningen eller försök igen.");
  const result: unknown = await response.json().catch(() => null);
  const parsed = z.object({ id: z.string().min(1).max(200) }).safeParse(result);
  if (!parsed.success) throw new EmailDeliveryError("E-posttjänstens svar kunde inte bekräftas.");
  return parsed.data.id;
}
