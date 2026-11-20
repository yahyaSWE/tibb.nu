import { dispatchBookingEmailOutbox } from "@/lib/email-outbox";
import { dispatchShopOrderEmails } from "@/lib/shop-email";
import { equalSecret } from "@/lib/security";
import { dispatchWellnessEmails } from "@/lib/wellness-email";
import { dispatchIntakeEmails } from "@/lib/intake-email";
import { dispatchDueBookingRefunds } from "@/lib/booking-cancellations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Utskicksjobbet är inte konfigurerat." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!equalSecret(request.headers.get("authorization") || "", `Bearer ${secret}`))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const bookings = await dispatchBookingEmailOutbox({ limit: 5 });
    const cancellations = await dispatchBookingEmailOutbox({ limit: 3, event: "cancellation" });
    const bookingRefunds = await dispatchDueBookingRefunds(1);
    const orders = await dispatchShopOrderEmails({ limit: 5 });
    const wellness = await dispatchWellnessEmails({ limit: 5 });
    const intake = await dispatchIntakeEmails({ limit: 5 });
    return Response.json({ ...bookings, cancellations, bookingRefunds, orders, wellness, intake }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Utskicksjobbet kunde inte slutföras. Kontrollera serverns anslutning." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
