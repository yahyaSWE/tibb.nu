# Anamnes inför rådgivning

`/anamnes` är öppen för besökare utan inloggning. Den nås från `/sjalvtest`,
huvudmenyns samlade ingång **Självtest & anamnes** och sidfotens länk
**Anamnes inför rådgivning**. Det befintliga självtestets frågor och poängmodell
är separata från anamnesen.

## Syfte och begränsningar

Anamnesen importerar en heuristisk TCM-modell med tio traditionella örtformler.
Modellen räknar överensstämmelse mellan givna svar och fasta regler. Poäng,
mönster och formelnamn är samtalsunderlag inom den traditionella modellen;
de är inte medicinska sannolikheter eller en diagnos.

Det finns ingen klinisk validering av frågeformuläret, poängvikterna,
gränsvärdena eller rangordningen. De angivna källorna nedan ger allmän
säkerhetsinformation och validerar inte denna modell eller dess resultat.
Ett resultat ska inte användas för att välja eller påbörja behandling.
Sidan ger ingen automatisk produktrekommendation, dosering eller koppling
till butikens varukorg. Formelnamn är endast traditionella referenser för
ett samtal med en kvalificerad behandlare.

## Svarens livslängd och sökmotorer

Formulärets tillstånd hålls i React-minnet under det aktuella besöket.
Formuläret skriver inte svar eller resultat till databas, `localStorage`,
`sessionStorage`, cookies eller URL och skickar dem inte med e-post eller
i nätverksanrop. En omladdning eller knappen **Rensa svar och börja om**
rensar formulärets tillstånd. Att lämna sidan är ingen garanti för rensning,
eftersom webbläsarens historik kan återställa sidan. Anamnesen gör ingen
automatisk journalanteckning eller överföring till en bokning.

Besökaren kan uttryckligen välja att kopiera sammanfattningen till urklipp.
Den kopian omfattas inte av formulärets återställning eller omladdning.

Den vanliga webbplatsen laddar fortfarande sida, skript och andra resurser
över nätverket. Påståendet ovan gäller formulärets svar och resultat.

Sidan använder `PRIVATE_METADATA` med `noindex`, `nofollow` och `noarchive`.
`next.config.ts` sätter även `X-Robots-Tag: noindex, nofollow, noarchive` och
`Referrer-Policy: no-referrer` för `/anamnes`. Rutten ingår inte i sajtens
sitemap. Detta begränsar indexering men är inte åtkomstkontroll; sidan är
avsiktligt offentlig.

## Säkerhetskällor

Kontrollerade 2026-10-16:

- [NCCIH: Traditional Chinese Medicine: What You Need To Know](https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know)
  beskriver bland annat risker med kinesiska örtprodukter och att TCM inte
  bör ersätta eller fördröja vanlig vård. Rådgör med hälso- och sjukvården
  innan örtprodukter används.
- [1177: Växtbaserade läkemedel och naturläkemedel](https://www.1177.se/undersokning-behandling/fler-behandlingar/alternativa-behandlingar/vaxtbaserade-lakemedel-och-naturlakemedel/)
  beskriver biverkningar, påverkan på andra läkemedel samt särskilda
  försiktighetsåtgärder vid graviditet och amning.

## Test med syntetiska uppgifter

Använd bara påhittade svar under utveckling och granskning.

1. Kör `npm test` och `npm run typecheck`. Granska att modellens tester
   omfattar tomma, partiella och fullständiga svar, lika poäng och
   förutsägbara resultat för fasta svarsmönster.
2. Starta arbetsytans isolerade utvecklingsserver med
   `node .test-data/membership-preview/dev.cjs`. Den använder den syntetiska
   lokala fixturen och nås på `http://127.0.0.1:3004`. Den vanliga `.env`
   kan peka på externa tjänster; använd därför den isolerade wrappern för
   denna granskning. Öppna `/sjalvtest` och följ länken till anamnesen.
   Kontrollera även mobilmenyn och sidfotslänken.
3. Öppna `/anamnes` utan inloggning. Gå igenom formuläret med tangentbord,
   välj enbart syntetiska uppgifter, ändra tidigare svar och visa resultat.
   Kontrollera att obesvarade obligatoriska säkerhetsfrågor stoppar fortsatt
   ifyllnad och inte behandlas som nekande svar. Resultatet ska tydligt anges
   som samtalsunderlag.
4. Kontrollera i webbläsarens nätverkspanel att syntetiska svar och resultat
   inte skickas när de fylls i eller resultat visas. Inspektera webbplatsens
   lagring och URL: svaren ska inte finnas där. Ladda om sidan och bekräfta
   att svar och resultat är borta.
5. Kontrollera smal och bred skärm, tydliga fokusmarkeringar och att alla
   val har begripliga etiketter. Testa formulärets återställning och
   eventuella kontroller för att gå bakåt eller hoppa över en fråga.
6. Begär `/anamnes` och kontrollera HTTP-huvudena `X-Robots-Tag` och
   `Referrer-Policy`. Kontrollera sidans robots-metadata och att den inte
   finns med i `/sitemap.xml`. Testa utgående källänkar utan svar i referer.

Testproceduren beskriver vad som ska verifieras och utgör ingen klinisk
validering av modellen.
