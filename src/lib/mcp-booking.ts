import { z } from "zod";
import {
  DomainError, expireBookings, getBookingByReference, getDb, getPractitioners,
  getSettings, getSlots, getTreatments, reserveBooking, transaction,
  type Booking, type Slot, type Treatment,
} from "./db";
import { getBusinessSettings } from "./business-settings";
import { cancellationText } from "./business-config";
import { enforceRequestLimit } from "./request-rate-limit";
import { equalSecret, randomToken, tokenHash } from "./security";
import { appUrl, createCheckout, getStripe, stripeReady } from "./stripe";
import { emailSchema, text } from "./validation";

const id = z.number().int().positive();
const bookingToken = z.string().regex(/^[a-f0-9]{64}$/)
  .describe("Privat bokningstoken från get_available_slots. Återanvänd samma token vid återförsök och statuskontroll. Dela den inte med andra.");
export const availableSlotsSchema = z.object({
  treatmentId: id,
  practitionerId: id.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(100).default(30),
}).strict().refine(value => !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to), {
  message: "Sluttiden måste vara senare än starttiden.",
});
export const bookingCheckoutSchema = z.object({
  bookingToken,
  slotId: id,
  offerVersion: z.string().regex(/^[a-f0-9]{64}$/)
    .describe("Oförändrad offerVersion för tiden som kunden har godkänt i get_available_slots."),
  name: text(100, 2),
  email: emailSchema,
  phone: text(30).default(""),
  userConfirmed: z.literal(true).describe("Kunden har uttryckligen godkänt behandling, behandlare, besöksform, tid och pris."),
  termsAccepted: z.literal(true).describe("Kunden har fått och godkänt återbudsregeln och bokningsvillkoren."),
  contactConsent: z.literal(true).describe("Kunden har godkänt att namn, e-post och telefon används för bokningen."),
}).strict();
export const bookingStatusSchema = z.object({ bookingToken }).strict();

export interface BookingCheckoutGateway {
  create(booking: Booking): Promise<string>;
  retrieve(sessionId: string): Promise<{ url: string | null; status: string | null }>;
}
export const stripeBookingGateway: BookingCheckoutGateway = {
  create: createCheckout,
  async retrieve(sessionId) {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {}, { timeout: 10000, maxNetworkRetries: 1 });
    return { url: session.url, status: session.status };
  },
};

async function publicTerms() {
  const business = await getBusinessSettings();
  const base = appUrl();
  return {
    legalName: business.legalName,
    organizationNumber: business.organizationNumber,
    cancellationHours: business.cancellationHours,
    cancellationNotice: cancellationText(business.cancellationHours),
    cancellationDetails: business.cancellationDetails,
    termsUrl: `${base}/villkor`,
    privacyUrl: `${base}/integritet`,
    contactConsentText: "Jag godkänner att mitt namn, min e-postadress och mitt telefonnummer används för att hantera bokningen.",
  };
}

function publicTreatment(treatment: Treatment) {
  return {
    id: treatment.id, name: treatment.name, description: treatment.description,
    durationMinutes: treatment.durationMinutes, priceOre: treatment.priceOre,
    currency: "SEK", deliveryMode: treatment.deliveryMode,
  };
}
function publicSlot(slot: Slot, treatment: Treatment, terms: Awaited<ReturnType<typeof publicTerms>>) {
  const offer = {
    slotId: slot.id, treatmentId: treatment.id, treatmentName: treatment.name,
    practitionerId: slot.practitionerId, practitionerName: slot.practitionerName,
    deliveryMode: treatment.deliveryMode, start: slot.start, end: slot.end,
    timeZone: "Europe/Stockholm", durationMinutes: treatment.durationMinutes,
    priceOre: treatment.priceOre, currency: "SEK",
  };
  return { ...offer, offerVersion: tokenHash(JSON.stringify({ offer, terms })) };
}

export async function listMcpTreatments() {
  const [treatments, practitioners, settings, terms] = await Promise.all([
    getTreatments({ activeOnly: true }), getPractitioners({ activeOnly: true }), getSettings(), publicTerms(),
  ]);
  return {
    treatments: treatments.map(publicTreatment),
    practitioners: practitioners.map(value => ({ id: value.id, name: value.name, description: value.description })),
    onlinePaymentAvailable: settings.stripeEnabled && stripeReady(),
    paymentMethod: "stripe", terms,
    instructions: "Visa behandling, behandlare, besöksform, svensk lokal tid, pris och villkor för kunden före bokning. Betalning slutförs av kunden i Stripe Checkout. Skicka inga kortuppgifter eller hälsouppgifter till verktygen.",
  };
}

export async function listMcpAvailableSlots(raw: unknown) {
  const input = availableSlotsSchema.parse(raw);
  const [treatments, practitioners, slots, terms] = await Promise.all([
    getTreatments({ activeOnly: true }), getPractitioners({ activeOnly: true }),
    getSlots({ treatmentId: input.treatmentId, practitionerId: input.practitionerId, futureOnly: true }), publicTerms(),
  ]);
  const treatment = treatments.find(value => value.id === input.treatmentId);
  if (!treatment) throw new DomainError("Behandlingen är inte tillgänglig.");
  const active = new Set(practitioners.map(value => value.id));
  const available = slots.filter(slot => !slot.booked && !slot.blocked && active.has(slot.practitionerId) &&
    (!input.from || Date.parse(slot.start) >= Date.parse(input.from)) &&
    (!input.to || Date.parse(slot.end) <= Date.parse(input.to)));
  return {
    bookingToken: randomToken(),
    slots: available.slice(0, input.limit).map(slot => publicSlot(slot, treatment, terms)),
    hasMore: available.length > input.limit, terms,
    instructions: "Token är privat. Använd den för en vald tid och återanvänd exakt samma token och bokningsuppgifter vid återförsök. Tider reserveras först när create_booking_checkout lyckas. Vid hasMore: hämta nästa period med from efter sista tidens start.",
  };
}

function bookingSummary(booking: Booking) {
  return {
    status: booking.status, paymentStatus: booking.paymentStatus,
    treatmentName: booking.treatmentName, practitionerName: booking.practitionerName,
    deliveryMode: booking.deliveryMode, start: booking.start, end: booking.end,
    timeZone: "Europe/Stockholm", priceOre: booking.priceOre, currency: "SEK",
    expiresAt: booking.status === "pending" ? booking.expiresAt : null,
    confirmationUrl: `${appUrl()}/bokning/bekraftelse?ref=${encodeURIComponent(booking.reference)}`,
    paymentVerified: booking.paymentStatus === "paid",
  };
}

export async function getMcpBookingStatus(raw: unknown, headers: Headers) {
  const input = bookingStatusSchema.parse(raw);
  await enforceRequestLimit("mcp-booking-status", input.bookingToken, 100, headers);
  await expireBookings();
  const request = await getDb().prepare("SELECT booking_reference FROM mcp_booking_requests WHERE token_hash=? AND access_expires_at>?")
    .get(tokenHash(input.bookingToken), new Date().toISOString());
  const booking = request ? await getBookingByReference(String(request.booking_reference)) : undefined;
  if (!booking) throw new DomainError("Bokningen hittades inte eller åtkomsten har gått ut.");
  return bookingSummary(booking);
}

export async function createMcpBookingCheckout(raw: unknown, headers: Headers, gateway = stripeBookingGateway) {
  const input = bookingCheckoutSchema.parse(raw);
  const { bookingToken: secret, ...details } = input;
  const key = tokenHash(secret);
  const fingerprint = tokenHash(JSON.stringify(details));
  await enforceRequestLimit("mcp-booking-attempt", secret, 20, headers);
  const booking = await transaction(async () => {
    await expireBookings();
    const previous = await getDb().prepare("SELECT * FROM mcp_booking_requests WHERE token_hash=?").get(key);
    if (previous) {
      if (!equalSecret(String(previous.request_hash), fingerprint))
        throw new DomainError("Bokningstoken har redan använts med andra uppgifter. Ändra inte uppgifterna vid återförsök.");
      if (String(previous.access_expires_at) <= new Date().toISOString())
        throw new DomainError("Åtkomsten till bokningen har gått ut. Hämta nya lediga tider.");
      const existing = await getBookingByReference(String(previous.booking_reference));
      if (!existing) throw new DomainError("Bokningen hittades inte.");
      return existing;
    }
    await enforceRequestLimit("booking", input.email, 10, headers);
    const slot = (await getSlots({ futureOnly: true })).find(value => value.id === input.slotId);
    const treatment = slot && (await getTreatments({ activeOnly: true })).find(value => value.id === slot.treatmentId);
    if (!slot || !treatment || !equalSecret(publicSlot(slot, treatment, await publicTerms()).offerVersion, input.offerVersion))
      throw new DomainError("Bokningsuppgifterna eller villkoren har ändrats. Hämta lediga tider och låt kunden godkänna det nya erbjudandet.");
    const reserved = await reserveBooking({ ...input, paymentMethod: "stripe" });
    await getDb().prepare("INSERT INTO mcp_booking_requests(token_hash,request_hash,booking_reference,access_expires_at,created_at) VALUES(?,?,?,?,?)")
      .run(key, fingerprint, reserved.reference, new Date(Date.parse(reserved.end) + 7 * 86400000).toISOString(), new Date().toISOString());
    return reserved;
  });
  if (booking.status !== "pending" || booking.paymentStatus !== "pending")
    return { ...bookingSummary(booking), checkoutUrl: null };
  try {
    // The existing Stripe integration uses a stable idempotency key per booking.
    // Never free the slot on an ambiguous network error: Stripe may have created
    // the checkout already. A retry recovers it; otherwise the hold expires.
    const session = booking.checkoutSessionId ? await gateway.retrieve(booking.checkoutSessionId) : null;
    const checkoutUrl = session ? (session.status === "open" ? session.url : null) : await gateway.create(booking);
    await expireBookings();
    const current = (await getBookingByReference(booking.reference))!;
    return {
      ...bookingSummary(current),
      checkoutUrl: current.status === "pending" && current.paymentStatus === "pending" ? checkoutUrl : null,
      instructions: "Låt kunden öppna betalningslänken och betala. Bokningen är bekräftad först när status är confirmed och paymentStatus är paid. Kontrollera med get_booking_status; vänta minst 10 sekunder mellan kontroller.",
    };
  } catch {
    throw new DomainError("Betalningslänken kunde inte hämtas. Reservationen finns kvar tills den löper ut. Försök igen med exakt samma bokningstoken och uppgifter; skapa inte en ny bokning.");
  }
}
