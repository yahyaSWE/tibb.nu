import { formatMoney } from "./time";
import type { Booking } from "./types";

export type CancellationDecision = "refund" | "retain" | "unpaid" | "collect";

export function bookingCancellationDecision(
  booking: Pick<Booking, "start" | "paymentMethod" | "paymentStatus" | "priceOre">,
  hours: number,
  requestedAt: number,
): CancellationDecision {
  if (!booking.priceOre) return "unpaid";
  const inTime = Date.parse(booking.start) - requestedAt >= hours * 60 * 60 * 1000;
  if (booking.paymentStatus === "paid" || booking.paymentStatus === "refunded") return inTime ? "refund" : "retain";
  return !inTime && booking.paymentMethod === "onsite" ? "collect" : "unpaid";
}

export function bookingCancellationText(decision: CancellationDecision, amountOre: number) {
  const amount = formatMoney(amountOre);
  switch (decision) {
    case "refund": return `Hela det betalda beloppet, ${amount}, återbetalas.`;
    case "retain": return `Det betalda bokningsbeloppet på ${amount} återbetalas inte vid sen avbokning.`;
    case "collect": return `Bokningsbeloppet på ${amount} kvarstår att betala vid sen avbokning. Kontakta mottagningen om betalningen.`;
    case "unpaid": return "Ingen betalning ska tas ut för den avbokade tiden.";
  }
}
