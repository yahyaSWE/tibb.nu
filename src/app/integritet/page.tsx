import Link from "next/link";
import { getSiteSettings } from "@/lib/site-data";
import { getBusinessSettings } from "@/lib/business-settings";
import { TextContent } from "@/components/learning/cards";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Integritet och personuppgifter",
  description:
    "Läs hur Tibb.nu hanterar personuppgifter för bokningar, elevkonton och betalningar samt hur du kontaktar verksamheten med frågor om dina uppgifter.",
  path: "/integritet",
});
export default async function PrivacyPage() {
  const [s, business] = await Promise.all([getSiteSettings(), getBusinessSettings()]);
  return (
    <section className="section container narrow prose">
      <h1>Integritet och personuppgifter</h1>
      <h2>Vem ansvarar för dina uppgifter?</h2>
      <p>
        Tibb.nu drivs av {business.legalName}, organisationsnummer {business.organizationNumber},
        som ansvarar för personuppgifterna på webbplatsen.
        {s.email && <> Du når oss på <a href={`mailto:${s.email}`}>{s.email}</a>.</>}
      </p>
      <h2>När du bokar en behandling</h2>
      <p>
        Vi sparar ditt namn, din e-postadress, ditt telefonnummer och uppgifter om
        vald behandling, behandlare, tid, pris och betalningsstatus. Vi använder dem
        för att hantera bokningen, ditt besök och betalningen. När e-posttjänsten
        är ansluten används din e-postadress också för bokningsbekräftelsen.
      </p>
      <p>
        Kortbetalning, när den är aktiverad, hanteras av Stripe. Kortuppgifter
        lagras inte i Tibb.nu:s databas.
      </p>
      <h2>När du beställer produkter</h2>
      <p>
        Vi sparar namn, e-postadress, eventuellt telefonnummer, beställda varor,
        priser, leveranssätt, accepterade köpvillkor och betalningsstatus.
        Vid frakt sparas också leveransadress, postnummer och ort. Uppgifterna
        används för betalning, leverans, kundservice och orderbekräftelse.
        Betalningen hanteras av Stripe och e-postbekräftelser av Resend när
        e-posttjänsten är ansluten.
      </p>
      <p>
        Varukorgen sparar bara produktnummer och antal lokalt i webbläsaren.
        Kontakt- och adressuppgifter sparas inte där. Du kan tömma varukorgen
        eller rensa webbplatsens data i webbläsaren. Beställningssidans privata
        länk ger åtkomst till beställningen; spara den och dela den inte.
      </p>
      <h2>Ditt elevkonto</h2>
      <p>
        Vi sparar ditt namn, din e-postadress, ett skyddat lösenord, e-postverifiering,
        dina kurstilldelningar och slutförda lektioner. Inloggning, verifiering och
        lösenordsåterställning använder sessionsuppgifter och tidsbegränsade engångskoder.
      </p>
      <p>
        Quizsvar, resultat och försök samt skrivuppgifter, inlämningar, återkoppling
        och uppgiftsversioner sparas för kursens genomförande. Administratören kan
        granska inlämnade svar. Privata utkast till skrivuppgifter visas inte i admin.
        Anonymisera personer i dina exempel och lämna inte andra personers
        personnummer eller hälsouppgifter i kursuppgifter.
      </p>
      <h2>När du köper en kurs</h2>
      <p>
        Kursköpet kopplas till ditt inloggade elevkonto. Vi sparar vald kurs,
        pris, moms, accepterade köpvillkor, betalningsstatus och uppgifter som
        identifierar betalningen hos Stripe. Om en grupp ingår sparar vi också
        vilken grupp du får tillgång till och ett eventuellt slutdatum.
        Uppgifterna används för att hantera köpet och din kurs- och gruppåtkomst.
      </p>
      <p>
        Betalningen hanteras av Stripe. Faktureringsadressen som du lämnar vid
        betalningen behandlas hos Stripe. Kortuppgifter lagras inte i Tibb.nu:s
        databas. Du ser dina kursköp när du är inloggad under Mina köp.
      </p>
      <h2>Grupper och abonnemang</h2>
      <p>
        Vi sparar dina grupptilldelningar och abonnemang, accepterade
        abonnemangsvillkor, pris, betalningsintervall, betalningsstatus och betald
        period. Uppgifterna används för att hantera medlemskapet och ge dig
        tillgång till gruppens kurser och privata material.
      </p>
      <p>
        Återkommande betalningar och kundportalen hanteras av Stripe.
        Faktureringsadressen som du lämnar vid betalningen behandlas hos Stripe.
        Kortuppgifter lagras inte i Tibb.nu:s databas. Gruppmaterial och bilagor
        visas endast för behöriga gruppmedlemmar och administratörer.
      </p>
      <h2>Självtestet och din webbläsare</h2>
      <p>
        Självtestets svar och resultat sparas lokalt i din webbläsare för att du
        ska kunna fortsätta senare. De skickas inte automatiskt till Tibb.nu:s
        server och kopplas inte till ditt elevkonto. Du kan ta bort dem genom att rensa
        webbplatsens data i webbläsaren. När du gör om testet ersätts tidigare svar.
      </p>
      <h2>Automatiskt lokalt utkast till anamnesen</h2>
      <p>
        Dina framsteg i anamnesen sparas automatiskt i den här webbläsaren.
        Berättelsen, kompletteringar, läkemedelsnamn, formulärsvar och platsen i
        frågeflödet sparas krypterat i webbläsarens lokala lagring. Det här är
        hälsouppgifter. Andra som använder samma webbläsarprofil kan också välja
        att återuppta utkastet.
      </p>
      <p>
        Utkastet kan återupptas i 24 timmar efter senaste sparningen. Utgångna
        utkast spärras och rensas när sidan öppnas igen, eller när tidsgränsen
        nås medan sidan är öppen. Du kan när som helst radera det via formuläret
        eller genom att rensa webbplatsens data. ”Rensa svar och börja om” tar
        också bort utkastet. Efter radering börjar sparandet igen när du ändrar
        svaren. Ett mottaget inskick till behandlaren rensar det aktuella lokala
        utkastet och avslutar sparandet för den inskickade anamnesen.
      </p>
      <p>
        Utkastet skickas inte till oss och kopplas inte till ett konto.
        De separata kontaktfälten, samtycken och AI-rapporter sparas inte i det
        lokala utkastet. Att fortsätta med extern AI kräver ett nytt aktivt val;
        inskickning till behandlaren är fortfarande ett separat val.
      </p>
      <h2>Frivilligt inskickade självtester och anamneser</h2>
      <p>
        Efter ett färdigt självtest eller en anamnes kan du, när inskickning är
        aktiverad, välja att skicka svar och resultat till oss inför kontakt eller
        konsultation. Du anger då namn och e-postadress. Telefonnummer är valfritt.
        Du behöver inget elevkonto. Uppgifterna skickas först när du bekräftar
        inskickningen och används som underlag för kontakten med dig.
      </p>
      <p>
        Kontaktuppgifter, svar och resultat lagras krypterat och kan bara läsas av
        administratörer med särskild behandlarbehörighet. Aktuell lagringstid och
        information om behandlingen visas innan du skickar. Efter lagringstidens
        slut spärras underlaget och rensas vid nästa rensningskörning. Du kan också
        kontakta oss för att begära radering. Att rensa webbläsaren tar inte bort
        ett underlag som du redan har skickat till oss.
      </p>
      <h2>Kakor och inbäddade videor</h2>
      <p>
        En nödvändig sessionskaka håller dig inloggad i högst sju dagar och tas
        bort när du loggar ut. Webbplatsens egen kod använder inga reklam- eller
        analyskakor.
      </p>
      <p>
        YouTube-spelaren laddas när du väljer att spela en video. Då ansluter din
        webbläsare till YouTube, som kan behandla exempelvis IP-adress och
        uppgifter om uppspelningen enligt sina egna villkor. Även andra externa
        videospelare och länkar kan ansluta dig till respektive leverantör.
      </p>
      <h2>Leverantörer och åtkomst</h2>
      <p>
        Vercel används för webbplatsens drift och privata uppladdade filer, och
        Turso för databasen i den publicerade tjänsten. Resend används när
        e-posttjänsten är ansluten och Stripe när kortbetalning är aktiverad.
        Behöriga administratörer får åtkomst till de uppgifter som behövs för
        bokningar, beställningar, elevkonton, kursadministration och medlemskap.
      </p>
      {business.internationalTransfers && <TextContent text={business.internationalTransfers} />}
      {business.legalBasis && <><h2>Rättslig grund</h2><TextContent text={business.legalBasis} /></>}
      {(business.bookingRetention || business.studentRetention) && (
        <>
          <h2>Hur länge sparas uppgifterna?</h2>
          {business.bookingRetention && <><h3>Bokningar</h3><TextContent text={business.bookingRetention} /></>}
          {business.studentRetention && <><h3>Elevkonton och kursuppgifter</h3><TextContent text={business.studentRetention} /></>}
        </>
      )}
      <h2>Dina rättigheter</h2>
      <p>
        Kontakta oss för att begära tillgång till eller rättelse av dina uppgifter.
        Du kan också begära radering, begränsning, överföring av uppgifter eller
        invända mot behandlingen när förutsättningarna för respektive rättighet
        är uppfyllda. Vi kan behöva kontrollera din identitet innan uppgifter lämnas ut.
      </p>
      <p>
        Du kan <a href="https://www.imy.se/privatperson/utfora-arenden/lamna-ett-klagomal/" target="_blank" rel="noopener noreferrer">
          lämna ett klagomål till Integritetsskyddsmyndigheten (IMY)
        </a> om du anser att dina personuppgifter hanteras felaktigt.
      </p>
      {business.additionalPrivacy && <TextContent text={business.additionalPrivacy} />}
      <p><Link href="/kontakt">Kontakta Tibb.nu</Link> · <Link href="/villkor">Boknings- och kursvillkor</Link></p>
    </section>
  );
}
