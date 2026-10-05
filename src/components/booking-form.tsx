"use client";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  CreditCard,
  Leaf,
  MapPin,
  UserRound,
} from "lucide-react";
import type { Practitioner, Slot, Treatment } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/time";
import { createBookingAction } from "@/lib/actions";
import { BookingCalendar } from "./booking-calendar";

function SubmitBooking() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="button button-primary">
      {pending ? "Din bokning behandlas…" : "Bekräfta bokning"}
      <ArrowRight size={17} />
    </button>
  );
}
export function BookingForm({
  treatments,
  practitioners,
  slots,
  initialTreatment,
  payOnSite,
  stripeEnabled,
  location,
  contactEmail,
}: {
  treatments: Treatment[];
  practitioners: Practitioner[];
  slots: Slot[];
  initialTreatment?: number;
  payOnSite: boolean;
  stripeEnabled: boolean;
  location: string;
  contactEmail: string;
}) {
  const [treatmentId, setTreatmentId] = useState(
    treatments.some((t) => t.id === initialTreatment)
      ? initialTreatment
      : treatments[0]?.id,
  );
  const [slotId, setSlotId] = useState<number | undefined>();
  const [practitionerId, setPractitionerId] = useState(practitioners[0]?.id);
  const [payment, setPayment] = useState(
    payOnSite ? "onsite" : stripeEnabled ? "stripe" : "",
  );
  const treatment = treatments.find((t) => t.id === treatmentId);
  const practitioner = practitioners.find((p) => p.id === practitionerId);
  const treatmentSlots = slots.filter(
    (s) => s.treatmentId === treatmentId && s.practitionerId === practitionerId,
  );
  const chosenSlot = treatmentSlots.find((s) => s.id === slotId);
  if (!treatments.length)
    return (
      <div className="empty-state">
        <Leaf strokeWidth={1.2} />
        <h3>Vi förbereder nya tider.</h3>
        <p>
          Behandlingar och bokningsbara tider publiceras här när mottagningen
          öppnar.
        </p>
        {contactEmail && (
          <a
            href={`mailto:${contactEmail}`}
            className="button button-secondary"
          >
            Kontakta oss
          </a>
        )}
      </div>
    );
  return (
    <div className="booking-layout">
      <div>
        <div className="booking-steps" aria-label="Bokningens steg">
          <span className="current">
            <b>1</b> Behandling
          </span>
          <span className={treatment ? "current" : ""}>
            <b>2</b> Behandlare
          </span>
          <span className={practitioner ? "current" : ""}>
            <b>3</b> Tid
          </span>
          <span className={chosenSlot ? "current" : ""}>
            <b>4</b> Dina uppgifter
          </span>
        </div>
        <form className="booking-form" action={createBookingAction}>
          <fieldset>
            <legend>Välj behandling</legend>
            <div className="treatment-options">
              {treatments.map((t) => (
                <label className="treatment-option" key={t.id}>
                  <div className="treatment-option-head">
                    <h3>{t.name}</h3>
                    <input
                      type="radio"
                      name="treatment"
                      value={t.id}
                      checked={treatmentId === t.id}
                      onChange={() => {
                        setTreatmentId(t.id);
                        setSlotId(undefined);
                      }}
                    />
                  </div>
                  <p>{t.description}</p>
                  <span className="treatment-option-meta">
                    <Clock3 size={13} />
                    {t.durationMinutes} minuter
                    <strong>{formatMoney(t.priceOre)}</strong>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Välj behandlare</legend>
            {practitioners.length ? (
              <div className="practitioner-options">
                {practitioners.map((person) => {
                  const count = slots.filter(
                    (slot) =>
                      slot.treatmentId === treatmentId &&
                      slot.practitionerId === person.id,
                  ).length;
                  return (
                    <label className="practitioner-option" key={person.id}>
                      <span className="practitioner-avatar" aria-hidden="true">
                        <UserRound size={22} strokeWidth={1.4} />
                      </span>
                      <span className="practitioner-copy">
                        <strong>{person.name}</strong>
                        {person.description && (
                          <span>{person.description}</span>
                        )}
                        <small>
                          {count
                            ? `${count} lediga tider för vald behandling`
                            : "Inga lediga tider för vald behandling"}
                        </small>
                      </span>
                      <input
                        type="radio"
                        name="practitioner"
                        value={person.id}
                        checked={practitionerId === person.id}
                        onChange={() => {
                          setPractitionerId(person.id);
                          setSlotId(undefined);
                        }}
                        aria-label={person.name}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="notice">
                Vi förbereder nya bokningsbara tider hos våra behandlare.
              </p>
            )}
          </fieldset>
          <fieldset>
            <legend>Hitta en ledig tid</legend>
            <p className="muted" style={{ fontSize: 11, marginBottom: 18 }}>
              Alla tider visas i svensk tid (Europe/Stockholm).
            </p>
            {treatmentSlots.length ? (
              <BookingCalendar
                key={`${treatmentId}-${practitionerId}`}
                slots={treatmentSlots}
                selectedSlotId={slotId}
                onSelect={setSlotId}
              />
            ) : (
              <div className="empty-state">
                <CalendarDays strokeWidth={1.3} />
                <h3>Inga lediga tider just nu.</h3>
                <p>
                  Välj en annan behandlare eller behandling, eller återkom när
                  nya tider har publicerats.
                </p>
                {contactEmail && (
                  <a className="text-link" href={`mailto:${contactEmail}`}>
                    Kontakta mottagningen <ArrowRight size={16} />
                  </a>
                )}
              </div>
            )}
          </fieldset>
          {chosenSlot && (
            <>
              <fieldset>
                <legend>Dina uppgifter</legend>
                <div className="form-grid">
                  <label className="field">
                    Namn
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                      placeholder="Ditt för- och efternamn"
                    />
                  </label>
                  <label className="field">
                    E-postadress
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      maxLength={254}
                      placeholder="namn@exempel.se"
                    />
                  </label>
                  <label className="field full-width">
                    Telefonnummer
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      maxLength={30}
                      placeholder="Ditt telefonnummer"
                    />
                    <small>
                      Används om vi behöver kontakta dig om ditt besök.
                    </small>
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Betalning</legend>
                <div className="payment-options">
                  {payOnSite && (
                    <label className="payment-option">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="onsite"
                        checked={payment === "onsite"}
                        onChange={() => setPayment("onsite")}
                        required
                      />
                      <MapPin size={17} />
                      <span>Betala vid besöket</span>
                    </label>
                  )}
                  {stripeEnabled && (
                    <label className="payment-option">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="stripe"
                        checked={payment === "stripe"}
                        onChange={() => setPayment("stripe")}
                        required
                      />
                      <CreditCard size={17} />
                      <span>Betala med kort via Stripe</span>
                    </label>
                  )}
                </div>
                {!payOnSite && !stripeEnabled && (
                  <p className="notice">
                    Bokningen öppnar när mottagningen har aktiverat ett
                    betalningsalternativ.
                  </p>
                )}
              </fieldset>
              <label className="consent-check">
                <input type="checkbox" name="consent" required />
                <span>
                  Jag har läst{" "}
                  <Link href="/integritet" target="_blank">
                    informationen om mina uppgifter
                  </Link>{" "}
                  och godkänner att de används för att administrera min bokning.
                </span>
              </label>
              {payment && <SubmitBooking />}
              <p className="muted" style={{ fontSize: 10, marginTop: 13 }}>
                {payment === "stripe"
                  ? "Du går vidare till Stripe för att slutföra din betalning."
                  : "Din tid bekräftas när bokningen har registrerats."}
              </p>
            </>
          )}
        </form>
      </div>
      <aside className="booking-summary" aria-live="polite">
        <span className="eyebrow">DITT BESÖK</span>
        <h3>En stund för dig.</h3>
        <div className="summary-item">
          <span>Behandling</span>
          <strong>{treatment?.name || "Välj behandling"}</strong>
        </div>
        <div className="summary-item">
          <span>Behandlare</span>
          <strong>{practitioner?.name || "Välj behandlare"}</strong>
        </div>
        <div className="summary-item">
          <span>Längd</span>
          <strong>
            {treatment ? `${treatment.durationMinutes} minuter` : "—"}
          </strong>
        </div>
        <div className="summary-item">
          <span>Tid</span>
          <strong>
            {chosenSlot
              ? formatDateTime(chosenSlot.start)
              : "Välj en ledig tid"}
          </strong>
        </div>
        {location && (
          <div className="summary-item">
            <span>Plats</span>
            <strong>{location}</strong>
          </div>
        )}
        <div className="summary-total">
          <span>Pris</span>
          <strong>{treatment ? formatMoney(treatment.priceOre) : "—"}</strong>
        </div>
        <p>
          Du får en bekräftelse på nästa sida. Spara den så att du har
          uppgifterna inför ditt besök.
        </p>
      </aside>
    </div>
  );
}
