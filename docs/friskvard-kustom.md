# Friskvård och Kustom Checkout

## Omfattning

Friskvård är en del av den befintliga butiken: samma produkt-ID, varukorg, serverberäknade priser/rabatter, ordertabell och e-postleverantör. `/friskvard` ger en mobilanpassad paketbyggare. `/admin/friskvard` hanterar tjänster, personliga klippkort, kvitton, användning, korrigeringar och redan betalda manuella köp.

I produktionsbygget är Kustom Checkout enda betalningsvalet för nya butiksordrar, behandlingsbokningar via webben och MCP samt engångsköp av kurser. Under **Admin → Inställningar** går det att pausa Kustom för behandlingsbokningar. Inställningen är på som standard och kassan öppnar när Kustoms serverinställningar är kompletta. Ordinarie behandlingspriser är inklusive 25 % moms som standard. Kursköp använder kursens momssats. Befintliga Stripe-betalningar och pågående Stripe-abonnemang hanteras hos Stripe. Nya abonnemangsköp är stängda tills återkommande betalningar kan anslutas.

Behandlingar bekräftas och kurser öppnas efter att servern verifierat hela debiteringen. Kunden namnges inte i orderraden och Kustom får som radnamn ”Behandlingsbokning” respektive ”Digital kurs”. Webhook för dessa köp är `/api/kustom/service-push`. Kör samma avstämningsjobb `/api/kustom/reconcile` även för bokningar och kurser, så att missade callbacks, passerade betalningsfrister och återbetalningar kan följas upp. Ett oklart svar när Kustom skapar ordern får inte skapa en ny debiterbar order. Kontakta verksamheten med köpets referens om en sådan betalning fastnar.

## Lokal utveckling och staging

Arbetsbranchen är `codex/friskvard`. Inga riktiga betalningar eller produktionsändringar ingår i denna implementation. Live-nycklar får inte användas för att prova ett stagingköp. Kustoms Playground använder separata nycklar.

Använd en separat stagingdatabas och en egen testdomän med HTTPS. Konfigurera endast servervariabler:

```dotenv
SHOP_PAYMENT_PROVIDER=kustom
KUSTOM_ENVIRONMENT=playground
KUSTOM_API_USERNAME=<API-användarnamn/Key ID från Playground>
KUSTOM_API_PASSWORD=<API-lösenord från Playground>
KUSTOM_LIVE_ENABLED=0
APP_URL=https://din-testdomän.example
```

Skapa Playground-uppgifter i Kustoms portal under Developers → API. API-användarnamnet är inte det bara Merchant ID-numret; det är Key ID/användarnamnet för API-behörigheten. Nycklar ska aldrig delas i chatten, skrivas i Git eller ha `NEXT_PUBLIC_`-prefix.

Vid en senare, uttryckligen godkänd driftsättning behövs `KUSTOM_ENVIRONMENT=production`, produktionsnycklar och `KUSTOM_LIVE_ENABLED=1`. Produktionsmiljön vägrar API-anrop om den sista flaggan inte är aktiverad. Ingen kod här aktiverar flaggan eller ändrar serverns produktionsinställningar automatiskt.

Kustom använder `https://api.playground.kustom.co` respektive `https://api.kustom.co`. Koden accepterar inte ett godtyckligt API-värdnamn. Kontots API-behörighet behöver omfatta Checkout, Hosted Payment Page och Order Management.

## Förbered i admin

1. Öppna **Friskvård** och skapa de två tjänsteutkasten. Friskvårdsakupunktur får utgångspriset 500 kr; individuell kostrådgivning får exempelpriset 600 kr. Utkasten är inaktiva tills de granskas och publiceras.
2. Granska namn, icke-medicinsk friskvårdsbeskrivning, pris inklusive moms, momssats och giltighet i månader. Standard är 12 månader. Tjänsterna får inte avse medicinsk behandling, medicinsk örtrådgivning, örter, kosttillskott eller allmänna presentkort. Momssatsen är redigerbar och ska motsvara verksamhetens bedömning; inget generellt momsbefriat vårdpåstående görs.
3. Fyll i det registrerade momsnumret och företagets fullständiga adress under Friskvård. Företagsnamn och organisationsnummer hämtas från verksamhetsinställningarna, och kontaktadressen från webbplatsinställningarna. Momsnummer härleds inte från organisationsnumret. Köp med friskvård blockeras om kvittouppgifter saknas.
4. Ställ in butikens riktiga köpvillkor och kontaktadress, publicera tjänsterna och aktivera butiken efter test. En butik med endast digitala tjänster kan ha både frakt och hämtning avstängda. Ett rent tjänsteköp får ingen fraktavgift och kräver inte ett fysiskt hämtningsval. Blandade köp behåller ordinarie leveransflöde.
5. Konfigurera befintlig Resend-anslutning med en verifierad avsändare. Även utan fungerande e-post finns PDF och klippkort på den privata beställningssidan; admin kan se och skicka om underlagen.

## Betalningskedjan

Kustoms slutförda checkout betyder **auktorisation**, inte automatiskt debitering. Order Management läses server till server. Varje läsning kontrollerar order-ID, intern referens, valuta, belopp och specificerade orderrader mot Tibb.nu:s historiska order. En retur från kundens webbläsare markerar aldrig betalning som genomförd.

- `checkout_complete` / `AUTHORIZED`: inget betalt friskvårdskvitto, inga aktiva klippkort.
- Digitala tjänster debiteras efter verifierad auktorisation, när det digitala köpet levereras. Vid blandade/fysiska order begär administratören debitering när ordern levereras, från ordervyn. Begäran har en beständig idempotensnyckel; resultatet hämtas och kontrolleras hos Kustom.
- Full verifierad capture med `CARD`, `PAY_BY_CARD`, `SWISH`, `APPLE_PAY_CARD` eller `GOOGLE_PAY_CARD` kan ligga till grund för betalt kvitto. Capturernas summa och datum kontrolleras också.
- `INVOICE`, `INVOICE_BUSINESS`, delbetalning och okända betalsätt får **inte** automatiskt ett betalt kundkvitto, även om Kustom har debiterat ordern. Administratören måste styrka hela kundbetalningen med ett kontrollerat betalningsunderlag, datum och unik referens. Därefter aktiveras kortet och kvittot skapas. Att Kustom betalat ut till handlaren är inte i sig bevis på att en fakturakund gjort sitt utlägg.

De sista betalningsmetodernas kundbetalning går inte att avgöra ur en vanlig Kustom-capture. Funktionen hittar inte på sådan information och gör inte en automatisk ”betald”-markering för dem. Arbetsgivarens krav på underlaget behöver fortfarande följas.

Kustoms push-URL skapas per order på `/api/kustom/push` med en slumpmässig callbackhemlighet. Bara dess hash sparas. Callbackens innehåll betraktas inte som betalningsbevis: ordern läses alltid tillbaka via autentiserat API. HPP:s statuscallback och Checkout-push kan båda nå samma endpoint. Logga eller publicera inte callback-URL:erna; de innehåller en hemlighet.

Checkout-create saknar providerstöd för idempotens. Ett osäkert create-svar upprepas därför inte blint. Den beständiga ordern sätts i kontrolläge, lagret behålls och kunden skickas till sin privata orderbekräftelse med instruktion att kontakta verksamheten. API:ets vanliga timeout får inte leda till en ny debiterbar order. En callback kan återfinna och verifiera ett provider-ID. Om ingen callback har kunnat knyta sessionen krävs kontroll i Kustom-portalen; skapa inte en ny betalningssession innan den gamla har retts ut.

## Avstämning och leverans

Administratören kan kontrollera status på ordern eller under Friskvård. `/api/kustom/reconcile` kan dessutom köras återkommande med `Authorization: Bearer <CRON_SECRET>` (minst 32 tecken). Den behandlar ett litet antal order per körning och läser även återbetalningar gjorda i portalen. Konfigurera detta jobb i staging/drift; enbart initial checkout-push garanterar inte upptäckt av en senare portalåterbetalning.

`/api/email/outbox` använder samma befintliga Cron-hemlighet och behandlar även friskvårdsutskick. Ingen ny automation eller extern schemaläggning skapas av koden. Planera dessa jobb i er drift, och övervaka fel och väntande order. En oklar Kustom-session frigör inte lager bara för att Tibb.nu:s gamla Stripe-reservationsgräns passerat. Kundens avbryt-knapp måste först få en verifierad avbruten Kustom-session; redan auktoriserade köp hänvisas till verksamheten.

Fysisk leverans får hanteras när Kustom-capture är styrkt, även om en fakturakunds separata utlägg ännu inte är styrkt. Detta ger inte den kunden ett betalt friskvårdskvitto.

## Kvitton, klippkort och återbetalning

Varje friskvårdsköp behåller en ögonblicksbild av säljaren, kundens fullständiga namn/adress, orderrader, moms och villkor. Kundadress krävs även för tjänster utan frakt så att underlaget har fullständiga fakturauppgifter även över 4 000 kr. Personnummer efterfrågas inte för kvittot och sparas inte från Kustoms kundobjekt. Medicinska uppgifter, anamneser och journalanteckningar ska aldrig läggas i tjänstenamn, kvitton, administrativa noteringar eller betalningsreferenser.

Kvittonummer i formatet `FV-ÅÅÅÅ-00001` tilldelas i en databastransaktion. Det går inte att skapa ett andra ursprungskvitto för samma köp genom att leverera callbacken igen. PDF genereras på servern i A4, sparas som en **privat BLOB i den befintliga databasen**, och återanvänds byte för byte. Inga offentliga filadresser skapas och en separat fillagringstjänst behövs inte för dessa små dokument. Kvittot är ett kompletterande underlag till orderns försäljning, inte en ny försäljning att bokföra en gång till.

Endast markerade friskvårdsrader tas med. Rabatter och rabattkoder beräknas först i den befintliga prisberäkningen; kvittot använder dessa faktiskt betalda radbelopp. Vanliga produkter och frakt ingår inte. Totalt inklusive moms, nettobelopp och moms per momssats visas. Korrigeringsunderlag har ett eget nummer och hänvisar till ursprungskvittot. Det gamla kvittot ändras aldrig.

Klippkort innehåller antal per tjänst, inget saldo i kronor. Två olika tjänster ger separata antal. Giltighet räknas från styrkt betalningsdatum, med kalenderkorrekt hantering av månadsslut och skottår. ”Använd ett klipp” och dess korrigeringar är transaktionssäkra och spårbara per administratör. Upprepning av samma åtgärdsreferens använder inte ett andra klipp. En registrering kan bara reverseras en gång. Förbrukade, spärrade eller utgångna kort kan inte användas.

Återbetalning av oanvända Kustom-tillfällen begärs från Friskvård. Klippen spärras innan API-anropet. Samma beständiga åtgärdsreferens används vid återförsök. Antal och separata korrigeringsunderlag uppdateras först efter verifierad återbetalning. Återbetalning i Kustom-portalen hämtas också vid avstämning. Om en partiell portalåterbetalning saknar radfördelning spärras korten för manuell kontroll; systemet gissar inte vilket klipp eller belopp som återbetalats. En fullständig återbetalning spärrar kortet och kan inte återställas av en äldre callback.

För manuella köp krävs ett unikt kontrollerat externt betalnings-/kassakvitto och ett uttryckligt intyg om genomförd betalning. Funktionen debiterar inte kunden och ersätter inte ett kassaregister. Manuella återbetalningar registreras på samma sätt först efter att de faktiskt genomförts i ordinarie system. Regler om kassaregister och verksamhetens redovisning ska följas i det ordinarie kassaflödet.

## Åtkomst och e-post

Den befintliga orderbekräftelsens slumpmässiga privata referens visar köpet. Länken är en åtkomstnyckel och ska inte delas. Därifrån skapas separata slumpmässiga PDF-nedladdningstoken med 15 minuters giltighet. Token sparas som hash och gäller exakt ett dokument. Kvittorouten kräver giltig token eller en aktuell adminsession, och svarar med `no-store`, `noindex` och `no-referrer`. Den kan inte användas för sökning via namn, e-post eller ordernummer.

E-post återanvänder Resend, med PDF bifogad. En egen beständig utkorg har unik händelsenyckel, lånad utskicksrätt, begränsade återförsök och samma provider-idempotensnyckel vid nätverksfel. Ett aktivt ”Skicka igen” i admin är en avsiktlig ny utskicksbegäran. Ingen verklig e-post har skickats av de automatiska testerna.

## Databas och tester

Schema **15** lägger till `is_service`, `wellness_eligible` och `validity_months` på befintliga `shop_products`. Tjänster förbrukar inte fysiskt lager. Övriga nya tabeller heter `shop_checkout_requests`, `kustom_checkouts`, `wellness_order_snapshots`, `wellness_payment_evidence`, `wellness_passes`, `wellness_redemptions`, `wellness_receipts`, `wellness_receipt_sequences`, `wellness_downloads`, `wellness_email_outbox`, `wellness_refunds`, `wellness_provider_events` och `wellness_manual_operations`. Migreringen är atomisk, publicerar inga nya tjänster och ändrar inte gamla order/priser.

Automatiska tester kör verklig SQLite och simulerar Kustom/Resend. De täcker beloppen 500, 4 000 och 4 100 kr, moms, blandade order, auktorisation kontra betalning, faktura, callback-idempotens, osäkra create-svar, klippförbrukning, korrigering, partiell återbetalning, manuella betalningsreferenser och privata nedladdningstoken. Migrering från schema 14 testas separat. PDF och webbgränssnitt ska också kontrolleras visuellt i desktop-/mobilstorlek.

Kör `npm run typecheck`, `npm test` och `npm run build`. Vid Windows-fillås i städning av testdatabaser kan testsamlingen köras med `npx tsx --test --test-concurrency=1 tests/*.test.ts`.

Lokal verifiering 2026-11-19: **596/596 tester godkända** vid seriell körning, inklusive 20 friskvårds-/migreringstester. Typkontroll och isolerat produktionsbygge godkända. Produktionsserverns `/friskvard` svarade 200 och en obehörig PDF-begäran 404. Paketbyggare, varukorg, kassa och admin har provats i webbläsare med syntetiska uppgifter; layout kontrollerad vid 390, 768 och 1 024 pixlar samt desktop. Exemplet 7 + 1 gav 4 100 kr inklusive 820 kr moms. Ett manuellt testköp gav privat PDF med adminåtkomst och nekad anonym åtkomst. A4-kvittot renderades och granskades visuellt. Inga verkliga betalningar eller e-postutskick gjordes. Externt Playground-/stagingtest är ännu inte genomfört eftersom testuppgifter saknas.

Den befintliga Next.js-versionen 16.4.2 rapporterar en säkerhetsuppdatering vid start. Uppgradering av befintliga beroenden ingår inte i denna ändring och bör hanteras före produktionssättning.

Innan staging godkänns: anslut **Playground**-nycklar, tillåt att Kustom når de specifika callback-URL:erna, använd separat databas och testavsändare, och genomför kort-/Swish-/faktura-/avbrotts-/återbetalningsfallen med Kustoms testdata. Den automatiska lokala simuleringen verifierar inte era faktiska API-behörigheter, Kustom-avtal, nätverksåtkomst eller externa e-postleveranser.

## Källor för regler och API

- [Skatteverket: Personalvårdsförmån, motion och friskvård](https://www.skatteverket.se/privat/skatter/arbeteochinkomst/formaner/personalvardmotionochfriskvard.4.7459477810df5bccdd4800014540.html): arbetsgivarens bedömning, årsgränsen, tillfällen utan motionsinslag, medicinska undantag och presentkort. Kontrollerat 2026-11-19.
- [Skatteverket: Momslagens regler om fakturering](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/fakturering/vadskaenfakturainnehalla.4.58d555751259e4d66168000403.html): fullständig faktura och förenklade fakturor. Använd fullständiga uppgifter för detta underlag och granska verksamhetens faktiska moms-/redovisningsförutsättningar.
- [Kustom: Autentisering och miljöer](https://docs.kustom.co/api/authentication/), [Hosted Payment Page](https://docs.kustom.co/checkout/surfaces/hosted-payment-page/), [orderlivscykel](https://docs.kustom.co/basics/order-lifecycle/), [debitering](https://docs.kustom.co/order-management/capture/), [idempotens](https://docs.kustom.co/order-management/idempotency-and-retries/) och [OpenAPI](https://docs.kustom.co/openapi/order-management.yaml). Kontrollerat 2026-11-19.
