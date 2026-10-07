import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";
import "./questions.css";

export const metadata = createPageMetadata({
  title: "Vanliga frågor om behandlingar, bokning och kurser", path: "/vanliga-fragor",
  description: "Svar om behandlingar i Jönköping, bokning, behandlare, priser, kursåtkomst och självtestet med fem faser på Tibb.nu.",
});

export default function QuestionsPage() {
  return (
    <section className="section container narrow">
      <div className="page-heading">
        <h1>Vanliga frågor</h1>
        <p>Inför din bokning, ditt lärande eller ditt första besök hos Tibb.nu.</p>
      </div>
      <div className="questions-list">
        <details open><summary>Hur bokar jag en behandling?</summary>
          <p>På <Link href="/boka">bokningssidan</Link> väljer du behandling och behandlare. Kalendern visar tillgängliga dagar månadsvis. Välj ett datum och därefter ett av dagens lediga klockslag. Fyll i dina uppgifter och bekräfta bokningen. Alla tider visas i svensk tid.</p>
        </details>
        <details><summary>Vad kostar behandlingarna och hur länge tar de?</summary>
          <p>Aktuellt pris och längd visas vid varje behandling på <Link href="/boka">bokningssidan</Link> och i sammanställningen innan du bekräftar. De betalningsalternativ som verksamheten har aktiverat visas när du bokar.</p>
        </details>
        <details><summary>Kan jag välja behandlare?</summary>
          <p>Ja. Efter att du har valt behandling visas tillgängliga behandlare. Kalendern visar sedan lediga tider för ditt val. Läs även om <Link href="/om">Johan Yahya Blomdahls bakgrund och utbildningar</Link>.</p>
        </details>
        <details><summary>Var finns Tibb.nu?</summary>
          <p>Verksamheten finns i Jönköping. Publicerade kontaktuppgifter och eventuell besöksadress finns på <Link href="/kontakt">kontaktsidan</Link>. Kontakta oss om du behöver praktisk information inför ett besök.</p>
        </details>
        <details><summary>Hur får jag tillgång till en kurs?</summary>
          <p>Läs först den offentliga <Link href="/kurser">kursbeskrivningen</Link> och kontakta Tibb.nu om kursåtkomst. Skapa sedan ett elevkonto med samma e-postadress som du uppger till administratören. Administratören tilldelar kursen. Efter inloggning hittar du dina tilldelade, publicerade kurser i elevportalen med lektioner och kursmaterial.</p>
        </details>
        <details><summary>Är självtestet en medicinsk diagnos?</summary>
          <p>Nej. <Link href="/sjalvtest">Självtestet med fem faser</Link> är avsett för utbildning och självreflektion. Det ersätter inte individuell bedömning eller vård och kräver inget konto. Dina svar sparas i den aktuella webbläsaren och skickas inte till servern.</p>
        </details>
      </div>
      <p>Hittar du inte svaret? <Link href="/kontakt">Kontakta Tibb.nu</Link>.</p>
    </section>
  );
}
