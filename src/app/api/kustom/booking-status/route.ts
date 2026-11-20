import { after } from "next/server";
import { z } from "zod";
import { getBookingByReference } from "@/lib/db";
import { dispatchBookingEmailOutbox, queueBookingEmails } from "@/lib/email-outbox";
import { KustomApiError } from "@/lib/kustom";
import { reconcileKustomServicePayment } from "@/lib/kustom-service-payments";
import { enforceRequestLimit } from "@/lib/request-rate-limit";
import { assertShopOrigin, shopRequestJson, shopResponseError } from "@/lib/shop-checkout";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const input = z.object({
  reference: z.string().regex(/^[a-f0-9]{32}$/),
  capturedOnly: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    assertShopOrigin(request);
    const { reference, capturedOnly } = input.parse(await shopRequestJson(request));
    await enforceRequestLimit("kustom-booking-status", reference, 20, request.headers);
    let booking = await getBookingByReference(reference);
    if (!booking || booking.paymentMethod !== "kustom") {
      return Response.json({ error: "Bokningen hittades inte." }, { status: 404, headers });
    }
    if (booking.status === "pending") {
      await reconcileKustomServicePayment(reference, undefined, capturedOnly ? "captured-only" : "normal");
      booking = (await getBookingByReference(reference)) ?? booking;
    }
    if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
      const bookingId = booking.id;
      after(async () => {
        await queueBookingEmails(bookingId);
        await dispatchBookingEmailOutbox({ bookingId, limit: 2 });
      });
    }
    return Response.json({ status: booking.status }, { headers });
  } catch (error) {
    if (error instanceof KustomApiError) {
      console.error("Kustom booking status request failed", { providerStatus: error.status });
    } else if (error instanceof z.ZodError) {
      console.error("Kustom booking status validation failed", error.issues.map(issue => issue.path.join(".")));
    }
    return shopResponseError(error);
  }
}
