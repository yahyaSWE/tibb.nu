# Tibb.nu – lanseringsgranskning

**Uppföljning:** [Genomförda lokala åtgärder och återstående inställningar](launch-improvements-2026-10-08.md). Rapporten nedan bevarar granskningens ursprungliga produktionsläge.

**Datum: 2026-10-08. Bedömning: tekniken fungerar, men tjänsten är inte redo för full kundlansering.** Kontaktväg, besöksinformation, villkor, integritetsinformation och verifiering av elevkonton behöver först bli klara. Kortbetalning är avstängd och hindrar inte en lansering med betalning på plats.

## Omfattning och verifierat läge

Granskningen omfattar offentlig webbplats, mobil- och formulärflöden, tillgänglighet, sökmetadata samt kod för autentisering, behörighet, bokning, betalning, uppladdningar, migrering och drift. Kontrollerna skapade inga skarpa kundbokningar eller betalningar. Produktionsuppgifter nedan är en ögonblicksbild från granskningen.

- Webbplatsen finns på [tibbnu.vercel.app](https://tibbnu.vercel.app). Canonical-adresser använder denna fungerande värd. Domänen tibb.nu ska kopplas senare; DNS-kontroller av A och MX gav NXDOMAIN, även via Cloudflare 1.1.1.1.
- Kontaktadressen är **kontakt@tibb.nu**, men mottagning kan inte verifieras med dagens DNS. Telefon saknas; platsen anges som Jönköping/Besök på plats utan besöksadress.
- Bokningen visar **Hijama våtkoppning, 45 minuter, 499 kr**, behandlare **Tibb.nu**, med en tid **11 oktober 2026 kl. 10.00, Europe/Stockholm**. Avbokningspolicy saknas.
- **Avancerad Hijama** är publicerad: **4 990 kr, 15 lektioner, fyra delar**. Kursen har inga elevtilldelningar och översikten visar inga kommande bokningar. Inga artiklar är publicerade. Tre nya källbelagda artiklar är sparade och deras texter återlästa i admin som opublicerade utkast: [kinesisk medicin](https://tibbnu.vercel.app/admin/artiklar/2), [hijama och våtkoppning](https://tibbnu.vercel.app/admin/artiklar/3) och [fem faser](https://tibbnu.vercel.app/admin/artiklar/4). Det tidigare välkomstutkastet är kvar.
- Betalning på plats är aktiv. Stripe-nycklar är inte anslutna och kortbetalning är avstängd. Kurser tilldelas manuellt; automatiskt kursköp ingår inte.

Nitton HTTP-kontroller gav förväntade svar: offentliga sidor 200, unika huvudrubriker/titlar/beskrivningar och korrekta robots/sitemap/llms. Privata sidor har noindex; säkerhetsheaders inkluderar nosniff, DENY och HSTS. Anonyma GET till `/admin`, `/elevportal` och `/elevportal/kurser/2` skickade NEXT_REDIRECT och metarefresh till `/logga-in`, utan admintabeller eller lektionstexter. Ett initialt strömmat 200 på en privat sida betyder därför inte beviljad åtkomst.

De tre nya artikelutkasten är även kontrollerade utan inloggning: ingen artikeltext exponeras, sidorna ger Next.js not-found och noindex och adresserna finns inte i sitemap. Strömning gör att HTTP-statusen kan vara 200 även för dessa saknade publika artiklar.

Mobilgrundkontroll av `/boka` och `/kurser` vid 320 px visade ingen horisontell overflow; header och meny rymdes, och menyn navigerade till kurskatalogen. Det ersätter inte en full mobilmatris/Lighthouse. `/setup` visar anonymt att ett adminkonto redan finns: första konfigureringen är stängd.

Live-admin visar verktygen för arbetsdagar, raster, spärrar, privata PDF/Word-filer och quiz/skrivuppgifter. Kursens översikt och första lektion öppnades i elevportalen utan att framsteg ändrades. Första YouTube-videon spelades; tillgängligheten hos samtliga 15 videor är inte verifierad. Inga provaktiviteter eller schematider lades till i produktion.

## Prioritet 1 – före kundlansering

1. **Blocker: fungerande kontakt och besöksinformation.** Ersätt kontaktadressen med en verifierad fungerande adress tills domän och e-post är anslutna. Bekräfta faktisk besöksadress, ansvarig verksamhet och kontaktväg. Visa informationen före bokning och på bekräftelsen. Bestäm och publicera regler för avbokning, ombokning och uteblivet besök; inventera kommande tider och ange en verklig behandlare om detta är ett personnamn.

2. **Blocker: komplett integritetsinformation.** `src/app/integritet/page.tsx` beskriver inte quizsvar/resultat, skrivutkast/inlämningar/feedback eller självtestets localStorage. Lägg till ändamål, rättslig grund, verklig personuppgiftsansvarig, mottagare/leverantörer, lagringstider eller kriterier, rättigheter och kontaktväg. Självtestet sparas endast i webbläsaren och skickas inte till servern; förklara hur användaren rensar det. Fyll inte i påhittade ansvariga eller lagringstider. Välj rättslig grund innan uppgifter samlas in; en bokningskryssruta ersätter inte information enligt artikel 13. Se [IMY om rättslig grund](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/rattslig-grund/) och [IMY om information till registrerade](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/de-registrerades-rattigheter/).

3. **Viktigt: verifiera elevens identitet före kursåtkomst.** `accounts.ts:5` registrerar e-post utan ägarverifiering; `admin.ts:603` tilldelar kursen till kontot med samma adress. Någon kan registrera kundens adress först och få kundens tilldelning. Inför verifierad e-post/inbjudan eller dokumenterad manuell identitetskontroll innan admin tilldelar åtkomst.

4. **Viktigt: avtals- och kursvillkor.** Klargör pris, vad kursen innehåller, tillgångstid, köp-/tilldelningsprocess, kontakt, avbokning och tillämplig ångerrätt. Klassificera avtalet utifrån den faktiska försäljningen. Om ett avtal med lagstadgad ångerrätt ingås genom webbplats/app krävs sedan **19 juni 2026** en ångerfunktion och mottagningsbevis. En kurs som admin tilldelar innebär inte i sig att ett sådant onlineavtal ingås. Kontrollera [Konsumentverket om kursavtal](https://www.konsumentverket.se/varor-och-tjanster/angra-eller-avboka-en-kurs-eller-utbildning/) och [information/ångerfunktion vid distansavtal](https://www.konsumentverket.se/marknadsratt-foretag/informationskrav-vid-distansavtal-regler-for-foretag/).

5. **Viktigt: undvik gemensam anropsspärr.** `actions.ts:90–99` använder samma globala nyckel när TRUST_PROXY saknas. Hundra försök med olika e-postadresser kan spärra all inloggning i 15 minuter; bokning har motsvarande tak. Använd betrodd besökaradress på Vercel och behåll e-postgränser. Lita inte generellt på klientstyrda proxyheaders. Se [Vercels IP-headers](https://vercel.com/docs/headers/request-headers).

## Prioritet 2 – innehåll, användbarhet och drift

- **Viktigt: bevara skrivna texter.** Admins artikel-/kurs-/lektionsformulär använder defaultValue och omdirigering; sparfel kan återställa formuläret till tidigare data. Returnera fälten vid valideringsfel och visa felet utan att kasta texten. Elevens skrivuppgift upptäcker osparade ändringar men saknar navigationsvarning/autosparning; lägg till varning eller tydlig automatisk utkastlagring med sparstatus.
- **Viktigt före aktiverad Stripe:** signerade främmande Checkout-sessioner ger 500 (`api/stripe/webhook/route.ts:38`). Reproducerat isolerat. Avgränsa med Tibb-metadata och ignorera främmande händelser; behåll återförsök för tillfälliga fel i egna betalningar. Verifiera därefter hela flödet i Stripe-testläge, inklusive avbrott, webhook och sen återbetalning. Se [Stripe om webhooks](https://docs.stripe.com/webhooks).
- **Viktigt:** dokumentera kontoåterställning och faktisk backup/återställning av Turso och privata Blob-filer. E-postutskick/lösenordsåterställning saknas. Bestäm hur nya bokningar upptäcks och bekräftas manuellt.
- **Förbättring:** lägg hopplänk i privata layouter, aria-current i publik navigation och radbrytning för långa rubriker. Två lokala korrigeringar i `cards.tsx` finns redan: örepriser avrundas inte och artikeldatum använder Stockholm. De är ännu inte publicerade.
- **Förbättring:** undanta `.test-data` i `.dockerignore`; inför städning för övergivna uppladdningar och Blob-filer vars kursmetadata raderats.
- **Förbättring för besökaren:** visa Johan Yahya Blomdahls namn och en valfri bild i behandlarvalet. Korta kurskortets ingress; den visar nu hela kursbeskrivningen. Beskriv målgrupp, förkunskaper, lärandemål och vad som räknas som genomförd kurs. Ge artikelredigeraren stöd för riktiga underrubriker och klickbara källor; nuvarande textfält visar underrubriker och webbadresser som vanliga textstycken.
- **Förbättring för sökbarhet:** anslut tibb.nu när domänen är klar, uppdatera webbplatsens URL-inställningar och verifiera sitemap/canonical igen. Registrera Search Console och publicera granskade artiklar. Ingen synlighet i Google eller AI-sök kan garanteras av metadata eller llms.txt.

## Testresultat och lanseringschecklista

Full lokal körning: **122/122 tester godkända**, isolerad Next-produktionskompilering godkänd och `npm audit --omit=dev` utan kända sårbarheter. Oberoende backendkontroll gav 77 godkända kontroller och ett Windows-EBUSY vid teststädning; samtliga funktionstester i den sviten passerade.

Kod/tester verifierar saltade lösenord, hashade sessioner, säkra cookies, sid-/actionbehörigheter, atomiskt dubbelbokningsskydd, pris-snapshots, signerade betalningar, privata kursfiler och historikbevarande migrering.

- [ ] Ägaren bekräftar fungerande kontakt, verklig besöksadress, verksamhetsuppgifter och avbokningsvillkor.
- [ ] Integritet, kursvillkor och elevverifiering blir klara; publicera bara färdiggranskat innehåll.
- [ ] Åtgärda textförlust/anropsspärr och publicera de lokala kortkorrigeringarna efter kontroll.
- [ ] Testa boknings-/elevflöde med ägarens testidentitet och verifiera driftåterställning.

**Inte verifierat:** skarp betalning, kundbokning, e-postleverans, produktions-Blob, backupåterställning, Google-indexering eller Core Web Vitals. Rapporten är ett granskningsunderlag; den innebär ingen godkänd full kundlansering. Ingen Git-push ingår.
