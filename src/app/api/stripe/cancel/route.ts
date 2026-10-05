import { NextResponse } from "next/server";
import { cancelPendingBooking, getBookingByReference } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("ref") || "";
  if (/^[a-f0-9]{32}$/.test(reference)) {
    const booking = await getBookingByReference(reference);
    if (booking?.status === "pending" && booking.paymentMethod === "stripe") {
      try {
        if (booking.checkoutSessionId)
          await getStripe().checkout.sessions.expire(booking.checkoutSessionId);
        await cancelPendingBooking(reference);
      } catch {
        return NextResponse.redirect(
          new URL(`/bokning/bekraftelse?ref=${reference}`, url.origin),
        );
      }
    }
  }
  return NextResponse.redirect(
    new URL(
      "/bokning?error=" +
        encodeURIComponent(
          "Kortbetalningen avbröts. Du kan välja en ny tid och försöka igen.",
        ),
      url.origin,
    ),
  );
}
