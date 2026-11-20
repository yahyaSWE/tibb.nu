"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  CreditCard,
  Leaf,
  MapPin,
  UserRound,
  Video,
} from "lucide-react";
import type { Practitioner, Slot, Treatment } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/time";
import { createBookingAction, quoteBookingCouponAction } from "@/lib/actions";
import { BookingCalendar } from "./booking-calendar";

function SubmitBooking({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="button button-primary">
      {pending ? "Din bokning behandlas…" : label}
      <ArrowRight size={17} aria-hidden="true" />
    </button>
  );
}
export function BookingForm({
  treatments,
  practitioners,
  slots,
  initialTreatment,
  initialPractitioner,
  payOnSite,
  onlineEnabled,
  onlineProvider = "stripe",
  location,
  contactEmail,
  cancellationNotice,
}: {
  treatments: Treatment[];
  practitioners: Practitioner[];
  slots: Slot[];
  initialTreatment?: number;
  initialPractitioner?: number;
  payOnSite: boolean;
  onlineEnabled: boolean;
  onlineProvider?: "stripe" | "kustom";
  location: string;
  contactEmail: string;
  cancellationNotice?: string;
}) {
  const [treatmentId, setTreatmentId] = useState(() =>
    treatments.some((t) => t.id === initialTreatment)
      ? initialTreatment
      : treatments.find(t => slots.some(slot => slot.treatmentId === t.id))?.id ?? treatments[0]?.id,
  );
  function firstAvailablePractitioner(id: number | undefined) {
    return practitioners.find(person => slots.some(slot => slot.treatmentId === id && slot.practitionerId === person.id))?.id
      ?? practitioners[0]?.id;
  }
  const [slotId, setSlotId] = useState<number | undefined>();
  const [practitionerId, setPractitionerId] = useState(() =>
    practitioners.some(person => person.id === initialPractitioner) ? initialPractitioner : firstAvailablePractitioner(treatmentId),
  );
  const [payment, setPayment] = useState(
    payOnSite ? "onsite" : onlineEnabled ? onlineProvider : "",
  );
  const treatment = treatments.find((t) => t.id === treatmentId);
  const practitioner = practitioners.find((p) => p.id === practitionerId);
  const treatmentSlots = slots.filter(
    (s) => s.treatmentId === treatmentId && s.practitionerId === practitionerId,
  );
  const chosenSlot = treatmentSlots.find((s) => s.id === slotId);
  const [codeDraft, setCodeDraft] = useState("");
  const [couponResult, setCouponResult] = useState<{
    slotId: number; code: string; result: Awaited<ReturnType<typeof quoteBookingCouponAction>>;
  }>();
  const [checkingCoupon, startCouponCheck] = useTransition();
  const code = codeDraft.trim().toUpperCase();
  const currentCoupon = couponResult?.slotId === chosenSlot?.id && couponResult?.code === code ? couponResult.result : null;
  const quote = currentCoupon?.quote;
  const totalOre = quote?.totalOre ?? treatment?.priceOre ?? 0;
  const canPay = payOnSite || onlineEnabled;
  const bookingReady = !!chosenSlot && canPay;
  const place = treatment?.deliveryMode === "remote" ? "Distans · digitalt möte" : location;

  function checkCoupon() {
    if (!chosenSlot || !code || checkingCoupon) return;
    const slot = chosenSlot.id;
    startCouponCheck(async () => {
      try {
        const result = await quoteBookingCouponAction(slot, code);
        setCouponResult({ slotId: slot, code, result });
      } catch {
        setCouponResult({ slotId: slot, code, result: { quote: null, error: "Det gick inte att kontrollera rabattkoden. Försök igen." } });
      }
    });
  }

  function chooseTreatment(id: number) {
    setTreatmentId(id);
    if (!slots.some(slot => slot.treatmentId === id && slot.practitionerId === practitionerId)) {
      setPractitionerId(firstAvailablePractitioner(id));
    }
    setSlotId(undefined);
  }

  function choosePractitioner(id: number) {
    setPractitionerId(id);
    setSlotId(undefined);
  }
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
        <form className="booking-form" action={createBookingAction}
          onSubmit={event => { if (checkingCoupon || (code && !quote)) event.preventDefault(); }}>
          <input type="hidden" name="returnTo" value={`/boka?behandling=${treatmentId ?? ""}&behandlare=${practitionerId ?? ""}`} />
          {!canPay && <p className="notice">Bokningen öppnar när ett betalningsalternativ har aktiverats.</p>}
          <div className="booking-mobile-choices">
            {treatments.length > 1 ? <label className="field">
              Behandling
              <select value={treatmentId} onChange={event => chooseTreatment(Number(event.target.value))}>
                {treatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label> : <h2 className="booking-single-treatment">{treatment?.name}</h2>}
            {treatment && (
              <p className="booking-mobile-meta">
                {treatment.durationMinutes} min · {treatment.deliveryMode === "remote" ? "Distans" : "På plats"}
                <strong>{formatMoney(treatment.priceOre)}</strong>
              </p>
            )}
            {practitioners.length > 1 ? (
              <label className="field">
                Behandlare
                <select value={practitionerId} onChange={event => choosePractitioner(Number(event.target.value))}>
                  {practitioners.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name}{!slots.some(slot => slot.practitionerId === person.id && slot.treatmentId === treatmentId) ? " · inga lediga tider" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : practitioner && <p className="booking-single-practitioner"><UserRound size={17} aria-hidden="true" />{practitioner.name}</p>}
            {(treatment?.description || practitioner?.description) && (
              <details className="booking-extra">
                <summary>Mer om besöket</summary>
                {treatment?.description && <p>{treatment.description}</p>}
                {practitioner?.description && <p>{practitioner.description}</p>}
              </details>
            )}
          </div>
          <fieldset className="booking-desktop-choices">
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
                      onChange={() => chooseTreatment(t.id)}
                    />
                  </div>
                  <p>{t.description}</p>
                  {t.deliveryMode === "remote" && <p className="treatment-delivery"><Video size={15} aria-hidden="true" />Distans · digitalt möte</p>}
                  <span className="treatment-option-meta">
                    <Clock3 size={16} aria-hidden="true" />
                    {t.durationMinutes} minuter
                    <strong>{formatMoney(t.priceOre)}</strong>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="booking-desktop-choices">
            <legend>Välj behandlare</legend>
            {practitioners.length ? (
              <div className="practitioner-options">
                {practitioners.map((person) => {
                  return (
                    <label className="practitioner-option" key={person.id}>
                      <span className="practitioner-avatar">
                        {person.photoUrl ? (
                          <img
                            src={person.photoUrl}
                            alt={person.name}
                            width={64}
                            height={64}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <UserRound
                            size={26}
                            strokeWidth={1.4}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="practitioner-copy">
                        <strong>{person.name}</strong>
                        {person.description && (
                          <span>{person.description}</span>
                        )}
                      </span>
                      <input
                        type="radio"
                        name="practitioner"
                        value={person.id}
                        checked={practitionerId === person.id}
                        onChange={() => choosePractitioner(person.id)}
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
            <legend>Välj tid</legend>
            <p className="booking-timezone">
              Tiderna visas i svensk tid.
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
                <h3>Inga lediga tider</h3>
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
          {bookingReady && chosenSlot && treatment && (
            <section className="booking-mobile-recap" aria-label="Vald bokning">
              <p><strong>{formatDateTime(chosenSlot.start)}</strong><strong>{formatMoney(totalOre)}</strong></p>
              <p>{treatment.name} · {treatment.durationMinutes} min</p>
              {place && <p>{place}</p>}
              <a className="text-link" href="#booking-contact">Fyll i dina uppgifter <ArrowRight size={16} aria-hidden="true" /></a>
            </section>
          )}
          <fieldset id="booking-contact" tabIndex={-1} hidden={!bookingReady} disabled={!bookingReady}>
            <legend>Dina uppgifter</legend>
            <div className="form-grid">
              <label className="field">
                För- och efternamn
                <input name="name" required minLength={2} maxLength={100} autoComplete="name" />
              </label>
              <label className="field">
                E-postadress
                <input name="email" type="email" required autoComplete="email" maxLength={254} />
              </label>
              <details className="booking-extra full-width">
                <summary>Lägg till telefonnummer (valfritt)</summary>
                <label className="field">
                  Telefonnummer
                  <input name="phone" type="tel" autoComplete="tel" maxLength={30} />
                </label>
              </details>
            </div>
          </fieldset>
          {bookingReady && (
            <>
              {payOnSite && onlineEnabled ? <fieldset>
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
                  {onlineEnabled && (
                    <label className="payment-option">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={onlineProvider}
                        checked={payment === onlineProvider}
                        onChange={() => setPayment(onlineProvider)}
                        required
                      />
                      <CreditCard size={17} />
                      <span>Betala via {onlineProvider === "kustom" ? "Kustom" : "Stripe"}</span>
                    </label>
                  )}
                </div>
              </fieldset> : <input type="hidden" name="paymentMethod" value={payment} />}
              <details className="booking-extra booking-coupon">
                <summary>Har du en rabattkod?</summary>
                <div className="booking-coupon-fields">
                  <label className="field">
                    Rabattkod
                    <input value={codeDraft} onChange={event => setCodeDraft(event.target.value)} maxLength={50}
                      autoComplete="off" autoCapitalize="characters" spellCheck={false}
                      onKeyDown={event => {
                        if (event.key === "Enter") { event.preventDefault(); checkCoupon(); }
                      }} />
                  </label>
                  <button type="button" className="button button-secondary" onClick={checkCoupon} disabled={!code || checkingCoupon}>
                    {checkingCoupon ? "Kontrollerar…" : "Använd kod"}
                  </button>
                </div>
                {code && <button type="button" className="text-link" onClick={() => { setCodeDraft(""); setCouponResult(undefined); }}>Ta bort kod</button>}
                {currentCoupon?.error && <p className="notice notice-error" role="alert">{currentCoupon.error}</p>}
                {code && !currentCoupon && !checkingCoupon && <p>Använd eller ta bort koden för att fortsätta.</p>}
                {quote && <p role="status">Rabatt {formatMoney(quote.discountOre)}. Nytt pris {formatMoney(quote.totalOre)}.</p>}
              </details>
              {quote && <><input type="hidden" name="couponCode" value={quote.code} /><input type="hidden" name="expectedPriceOre" value={quote.totalOre} /></>}
              {treatment?.deliveryMode === "remote" && <p className="booking-visit-note">Möteslänken läggs till på din privata bokningssida.</p>}
              {cancellationNotice && (
                <p className="booking-visit-note">{cancellationNotice}</p>
              )}
              <label className="consent-check">
                <input type="checkbox" name="consent" required />
                <span>
                  Jag har läst{" "}
                  <Link href="/integritet" target="_blank" rel="noopener noreferrer">
                    informationen om mina uppgifter
                  </Link>{" "}
                  och <Link href="/villkor" target="_blank" rel="noopener noreferrer">bokningsvillkoren</Link>.
                </span>
              </label>
              {payment && <SubmitBooking disabled={checkingCoupon || (!!code && !quote)} label={payment === onlineProvider && treatment ? `Till betalning · ${formatMoney(totalOre)}` : "Bekräfta bokning"} />}
              <p className="booking-payment-note">
                {payment === onlineProvider
                  ? `Du går vidare till ${onlineProvider === "kustom" ? "Kustom" : "Stripe"} för att slutföra din betalning.`
                  : "Din tid bekräftas när bokningen har registrerats."}
              </p>
            </>
          )}
        </form>
      </div>
      <aside className="booking-summary" aria-live="polite">
        <h3>Din bokning</h3>
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
        {place && (
          <div className="summary-item">
            <span>Plats</span>
            <strong>{place}</strong>
          </div>
        )}
        {quote && <div className="summary-item"><span>Rabatt</span><strong>−{formatMoney(quote.discountOre)}</strong></div>}
        <div className="summary-total">
          <span>Pris</span>
          <strong>{treatment ? formatMoney(totalOre) : "—"}</strong>
        </div>
        <p>
          Du får en bekräftelse på nästa sida. Spara den så att du har
          uppgifterna inför ditt besök.
        </p>
      </aside>
    </div>
  );
}
