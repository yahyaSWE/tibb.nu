# Tibb.nu

En fungerande Next.js-tjänst för behandlingar, bokning, artiklar, kurser och elevportal. Gränssnittet är på svenska, med olivgrönt och jordtoner. Data sparas lokalt i SQLite eller i en beständig Turso/libSQL-databas när appen körs på Vercel.

## Publicera på Vercel och skapa första admin

1. Importera GitHub-repot `yahyaSWE/tibb.nu` som ett nytt Vercel-projekt. Välj **Next.js** och **Node.js 24.x**. Behåll standardkommandona för installation och build.

   `vercel.json` anger Next.js, `npm run build` och `.next` även om projektet tidigare har identifierats som **Other**. Projektets **Root Directory** ska vara projektroten (`./`). Om en gammal deployment visar Vercels `404: NOT_FOUND`, publicera den senaste committen på `main`; kör inte bara om en äldre commit utan konfigurationsfilen.

2. Anslut **Turso** via Vercel Marketplace/Storage, eller skapa en libSQL-databas hos Turso och lägg in anslutningen själv. Välj gärna en europeisk databasregion. [Turso-integrationen](https://vercel.com/marketplace/tursocloud/database) använder miljövariablerna `TURSO_DATABASE_URL` och `TURSO_AUTH_TOKEN`.
3. Lägg in följande under projektets **Settings → Environment Variables**, för **Production**:

   | Variabel             | Värde                                                                         |
   | -------------------- | ----------------------------------------------------------------------------- |
   | `TURSO_DATABASE_URL` | Turso-databasens `libsql://…`-adress                                          |
   | `TURSO_AUTH_TOKEN`   | Databasens hemliga åtkomsttoken                                               |
   | `SETUP_TOKEN`        | En slumpmässig, hemlig token med minst 32 tecken                              |
   | `APP_URL`            | Din offentliga adress, till exempel `https://tibb.nu` eller din Vercel-adress |

4. Publicera eller kör **Redeploy** när miljövariablerna är sparade. Databastabellerna skapas automatiskt vid första användningen. `npm run db:init` kan också köras lokalt med databasens miljövariabler om du vill förbereda tabellerna före publicering.
5. Öppna `https://din-domän/setup`. Ange samma **SETUP_TOKEN** som du sparade i Vercel, ditt namn, din e-postadress och ett lösenord med minst 12 tecken. Skicka formuläret. Du blir inloggad som admin.
6. Ta bort `SETUP_TOKEN` från Vercels miljövariabler och kör **Redeploy**. Det redan skapade administratörskontot finns kvar i databasen. Logga hädanefter in via `/logga-in` och administrera sidan via `/admin`.

Du kan skapa en slumpmässig token i din egen terminal med:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Klistra in resultatet i Vercel och i setup-formuläret; lägg det inte i Git eller i chatten. Inga av dessa variabler ska ha prefixet `NEXT_PUBLIC_`. Se [Vercels miljövariabler](https://vercel.com/docs/environment-variables).

Vercel behöver en extern databas eftersom funktionernas lokala disk inte ger gemensam beständig lagring. Appen använder därför aldrig en lokal SQLite-fil på Vercel. Utan databasanslutning visas en tillfällig välkomstsida och bokningar hålls stängda. [Vercels förklaring](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

GitHub innehåller koden. Konton, artiklar, kurser och bokningar som du lagt in lokalt följer **inte** med en Git-push; de sparas i den lokala databasen. En ny Turso-databas får ett eget första adminkonto. Ändringar från admin i den publicerade tjänsten sparas i Turso och finns kvar efter nya driftsättningar.

Använd en **separat databas** för Vercel Preview om du vill prova ändringar; koppla inte oavsiktligt utvecklings-/previewmiljöer till din skarpa kunddatabas. Databasanslutning och skarpa Stripe-betalningar har inte testats mot ditt konto eftersom nycklarna inte har anslutits här.

## Starta lokalt

Du behöver **Node.js 24.x**.

```sh
npm install
npm run dev
```

Öppna http://localhost:3000. En `.env.local` med en slumpmässig konfigurationstoken finns redan i den här arbetsmappen och är undantagen från Git. Vid en ny installation kopierar du `.env.example` till `.env.local` och fyller i `APP_URL`.

## Skapa ditt administratörskonto

För **lokal utveckling**: kör följande i en separat terminal i projektmappen och ange ditt namn, din e-postadress och ett lösenord med minst 12 tecken. Lösenordet döljs när du skriver. På Vercel använder du webbsidan `/setup` enligt guiden ovan.

```sh
npm run setup
```

Logga sedan in på `/logga-in` och öppna `/admin`. Det finns inga förinställda konton eller lösenord. Det första kontot skapas bara en gång. Alternativt kan du använda `/setup` med en lång slumpmässig `SETUP_TOKEN` i servermiljön. Ta bort token ur miljön när kontot har skapats.

## Arbeta i admin

- **Behandlingar:** skapa och ändra namn, beskrivning, längd och pris. Aktivera en behandling för att visa den på bokningssidan. Startbehandlingarna är inaktiva exempel.
- **Behandlare:** lägg till namn och presentation för varje behandlare. Befintliga tider och bokningar kopplas vid uppgraderingen till behandlaren **Tibb.nu**, vars namn du kan ändra. Inaktiva behandlare visas inte för kunder; deras bokningar och historik behålls.
- **Tillgängliga tider:** välj behandling, behandlare, datumperiod, veckodagar och arbetstider. Tider skapas automatiskt utifrån behandlingens längd, med plats för återkommande raster. Du kan publicera upp till 90 dagar åt gången; nya perioder läggs till vid behov. Befintliga tider och bokningar dubbleras inte. Enstaka tider kan fortfarande läggas till separat. Varje behandlare har sitt eget schema och dubbelbokningsskydd.
- **Raster och ledighet:** spärra hela dagar eller ett sammanhängande tidsintervall för en behandlare eller för alla. Spärrade tider går inte att boka, även från ett äldre öppet bokningsformulär. Ta bort spärren för att återöppna de publicerade tiderna. En spärr som överlappar en befintlig bokning avvisas; hantera bokningen först. Att ta bort en publicerad period tar bara bort dess framtida lediga tider och bevarar bokningshistoriken. Alla tider hanteras i Europe/Stockholm, även vid sommartid.
- **Bokningar:** se kontaktuppgifter och betalningsstatus, hantera besöksstatus och avbokningar. Bokningens namn, längd och pris sparas separat så att senare prisändringar inte ändrar befintliga bokningar.
- **Artiklar:** skriv titel, ingress och brödtext. Spara utkast eller publicera. Publicerade artiklar visas direkt på webbplatsen.
- **Kurser:** skapa kursinformation och lägg till ordnade lektioner med text, video och länkar till material. Förhandsgranska i elevportalen och publicera när kursen är klar. Startkursen och startartikeln är utkast.
- **Elever:** eleven skapar sitt konto på `/registrera`. Tilldela en kurs med elevens e-postadress. Återkallad tillgång stoppar åtkomst men bevarar framsteg om du senare tilldelar kursen igen.
- **Inställningar:** ändra namn, kontaktuppgifter, plats och betalningsalternativ.

Kurser tilldelas av admin; automatiska kursköp ingår inte i denna version. Eleven ser tilldelade publicerade kurser och kan markera lektioner som slutförda. Text lagras och återges som vanlig text med stycken. Bilder, filuppladdning och avancerade quiz är inte implementerade i kursbyggaren.

På bokningssidan visas lediga dagar i en månadskalender för vald behandling och behandlare. Kunden väljer datum och ser sedan bara den dagens klockslag. Det går att bläddra mellan månader eller välja månad direkt. Vald behandlare visas även på bokningsbekräftelsen.

## Anslut Stripe

Bokning med **betalning vid besöket** fungerar utan en extern betaltjänst. Kortbetalning är en riktig Stripe Checkout-integration som blir tillgänglig först när den är korrekt konfigurerad.

Ange följande som serverhemligheter i `.env.local` lokalt eller hos din driftleverantör:

```dotenv
APP_URL=https://tibb.nu
STRIPE_SECRET_KEY=din_hemliga_stripe_nyckel
STRIPE_WEBHOOK_SECRET=din_webhook_hemlighet
```

Använd Stripes testnycklar först. Registrera webhookadressen `https://tibb.nu/api/stripe/webhook` med händelserna `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` och `charge.refunded`. När miljövariablerna är sparade kör du **Redeploy på Vercel**, eller startar om den lokala servern. Aktivera därefter kortbetalning under **Admin → Inställningar**.

Lokalt kan Stripe CLI vidarebefordra testhändelser till `localhost:3000/api/stripe/webhook`; använd den webhookhemlighet CLI:n ger. API-nycklar och webhookhemligheter skickas aldrig till webbläsaren. Betalningar bekräftas med signerade webhooks och kontrollerat belopp/valuta. Besökets pris tas från databasen. Att öppna bekräftelsesidan markerar aldrig en bokning som betald.

Kortbokningar reserveras i 35 minuter. Avbruten eller utgången betalning frigör tiden. Vid en betalning som kommer efter att reservationen har frigjorts återbetalas betalningen via Stripe. Återbetalningar för redan bekräftade besök hanteras i Stripe Dashboard; status uppdateras via webhook. API-anslutningen och betalningsflödet behöver verifieras med ditt Stripe-konto före skarp användning.

## Drift

```sh
npm run build
npm start
```

På **Vercel** följer du guiden ovan och använder Turso. Som alternativ kan du drifta en egen Node-server med **beständig disk**, HTTPS och en appinstans. Utan Turso-inställningar används `TIBB_DATABASE_PATH` (standard: `data/tibb.sqlite`) utanför Vercel. Dockerfiler finns för det alternativet med en beständig datavolym; sätt `APP_URL` till din offentliga HTTPS-adress.

Starta Docker med `docker compose --env-file .env.local up --build -d` när miljövärden och en HTTPS-proxy är konfigurerade. Dockerkonfigurationen har förberetts, men har inte körts i den här miljön.

Säkerhetskopiera med SQLite backup API eller en konsekvent SQLite-snapshot; kopiera inte bara en aktiv databasfil och ignorera WAL-filen. Starta om utvecklingsservern om du kör CLI-konfiguration eller flyttar databasen under utveckling.

Sessionskakan är HttpOnly, SameSite=Lax och Secure i produktion. Roller och kursåtkomst kontrolleras även vid serveråtgärder. Lösenord skyddas med saltad scrypt. Bokningar och ändringar valideras på servern. `TRUST_PROXY=1` ska bara användas om din egen proxy ersätter inkommande `X-Forwarded-For`; annars används gemensamma och e-postbaserade anropsgränser.

Innan du öppnar för kunder: fyll i verksamhetens kontaktuppgifter, egna texter, korrekta priser och tider, och anpassa integritetsinformationen till din verksamhet. Bokningsbekräftelse visas på sidan. E-postutskick och självbetjäning för lösenordsåterställning är inte anslutna.

## Kontroller

```sh
npm run typecheck
npm test
npm run build
```

Tester använder separata tillfälliga databaser och täcker bland annat verklig konkurrens mellan bokningar, roller, skyddade kurslektioner, publicering, prisbevarande, betalningsstatus och svensk tidszon.

## Bild

`public/images/olive-still-life.png` är skapad med det inbyggda imagegen-verktyget för detta projekt. Den exakta prompten sparas i `public/images/olive-still-life.prompt.txt`. Prompten beskrev ett fotografiskt stilleben med olivkvistar i handgjord keramik på travertin, varm kalkstensvägg och naturligt solljus, i olivgrönt och jordtoner utan text eller personer. Det finns inga externa fotografier eller påhittade patientomdömen på webbplatsen.

Teknisk referens: [Next.js](https://nextjs.org/docs/app), [Turso/libSQL](https://docs.turso.tech/sdk/ts/reference), [Stripe Checkout](https://docs.stripe.com/payments/checkout).
