import { getSettings } from "@/lib/db";
export const metadata = { title: "Integritet" };
export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <section className="section container narrow prose">
      <span className="eyebrow">DINA UPPGIFTER</span>
      <h1>Integritet.</h1>
      <p>
        När du bokar sparas ditt namn, din e-postadress, ditt telefonnummer samt
        uppgifter om behandling, tid och betalningsstatus. Uppgifterna används
        för att administrera ditt besök.
      </p>
      <h2>Ditt elevkonto</h2>
      <p>
        För elevportalen sparas ditt namn, din e-postadress, ett skyddat
        lösenord, dina kurstilldelningar och vilka lektioner du har slutfört.
      </p>
      <h2>Betalning och kakor</h2>
      <p>
        Om kortbetalning är aktiverad hanteras den av Stripe. Kortuppgifter
        lagras inte hos Tibb.nu. Vi använder en nödvändig sessionskaka för att
        hålla dig inloggad.
      </p>
      <h2>Kontakt</h2>
      <p>
        Kontakta verksamheten om du har frågor om dina uppgifter eller vill
        begära att de rättas eller tas bort.
        {s.email && (
          <>
            {" "}
            Skriv till <a href={`mailto:${s.email}`}>{s.email}</a>.
          </>
        )}
      </p>
    </section>
  );
}
