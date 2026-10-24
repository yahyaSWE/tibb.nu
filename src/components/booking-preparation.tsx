import Link from "next/link";
import { anamnesPreparation } from "@/lib/booking-details";

export function BookingPreparation({ start, now }: { start: string; now?: number }) {
  if (Date.parse(start) <= (now ?? Date.now())) return null;
  return <section className="notice booking-preparation" aria-labelledby="booking-anamnes-title">
    <h2 id="booking-anamnes-title">Inför ditt möte</h2>
    <p>{anamnesPreparation(start, now)}</p>
    <p>Fyll i formuläret och välj ”Skicka till behandlaren” när du är klar.</p>
    <Link href="/anamnes" className="button button-primary" prefetch={false}>Fyll i och skicka anamnesen</Link>
  </section>;
}
