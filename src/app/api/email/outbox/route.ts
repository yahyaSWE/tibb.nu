import { dispatchBookingEmailOutbox } from "@/lib/email-outbox";
import { equalSecret } from "@/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Utskicksjobbet är inte konfigurerat." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!equalSecret(request.headers.get("authorization") || "", `Bearer ${secret}`))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    return Response.json(await dispatchBookingEmailOutbox({ limit: 10 }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Utskicksjobbet kunde inte slutföras. Kontrollera serverns anslutning." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
