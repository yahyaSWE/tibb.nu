import { z } from "zod";
import type { Booking } from "./types";
import { formatDateTime } from "./time";

export const DeliveryModeSchema = z.enum(["onsite", "remote"]);
export const MeetingUrlSchema = z.string().trim().max(2000, "Möteslänken är för lång.").transform((value, context) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || /[\s\u0000-\u001f\u007f]/u.test(value)) throw new Error();
    return url.toString();
  } catch {
    context.addIssue({ code: "custom", message: "Ange en giltig möteslänk som börjar med https://, utan inloggningsuppgifter i adressen." });
    return z.NEVER;
  }
});

export type BookingVisit = Pick<Booking, "deliveryMode" | "meetingUrl" | "status" | "paymentMethod" | "paymentStatus">;

// The random booking reference protects the page. Meeting links are only
// rendered for confirmed bookings after any Stripe payment has cleared.
export function customerMeetingUrl(booking: BookingVisit): string | null {
  if (booking.deliveryMode !== "remote" || booking.status !== "confirmed" ||
      (booking.paymentMethod === "stripe" && booking.paymentStatus !== "paid")) return null;
  const parsed = MeetingUrlSchema.safeParse(booking.meetingUrl);
  return parsed.success && parsed.data ? parsed.data : null;
}

export function anamnesPreparation(start: string, now = Date.now()): string {
  const due = new Date(Date.parse(start) - 24 * 60 * 60 * 1000).toISOString();
  return Date.parse(due) > now
    ? `Skicka in din anamnes minst 24 timmar före mötet, senast ${formatDateTime(due)} (svensk tid), så att behandlaren hinner förbereda sig.`
    : "Anamnesen ska skickas in minst 24 timmar före mötet. Om du har bokat med kortare framförhållning, skicka in den så snart som möjligt före mötet.";
}
