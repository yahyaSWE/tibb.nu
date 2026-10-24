import { customerMeetingUrl, type BookingVisit } from "@/lib/booking-details";

export function BookingVisitDetails({ booking, location }: { booking: BookingVisit; location: string }) {
  const remote = booking.deliveryMode === "remote";
  const meetingUrl = customerMeetingUrl(booking);
  return <>
    <div><dt>Plats</dt><dd>{remote ? "Distans · digitalt möte" : location || "Kontakta mottagningen"}</dd></div>
    {remote && booking.status === "confirmed" && <div><dt>Möteslänk</dt><dd>{meetingUrl
      ? <a className="text-link" href={meetingUrl} target="_blank" rel="noopener noreferrer">Öppna mötet</a>
      : "Behandlaren lägger till möteslänken här. Spara sidan och återkom före mötet."}</dd></div>}
  </>;
}
