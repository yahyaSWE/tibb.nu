# Frivillig inskickning av självtest och anamnes

Efter färdigt självtest på `/sjalvtest` eller anamnes på `/anamnes` kan besökaren välja att skicka sitt underlag. Namn och e-post krävs, telefon är valfritt. Inget elevkonto behövs. Ett separat, från början omarkerat inskickningsval krävs. Att bara göra testet, öppna resultatet eller fylla i kontaktfälten skickar inte uppgifterna.

Admin → **Inskickade underlag** (`/admin/inskickade-underlag`) samlar båda typerna med namn, e-post, typ och datum. Öppna en rad för fullständiga svar, resultat och kontaktuppgifter. Anamnesens befintliga terapeutbedömningar och radering fungerar som tidigare. Självtestet har en separat detaljvy med radering. Ingen e-post skickas; Resend behövs inte för denna funktion.

## Konfiguration

Funktionen använder befintliga inställningar för säker inskickning. **Admin → Anamnes** visar exakt vad som saknas i den aktuella miljön:

- `ANAMNES_STORAGE_KEY`: behåll befintlig nyckel om ärenden redan lagras. Generera annars en ny slumpmässig 32-byte-nyckel och spara dess 64 hextecken direkt i Vercels skyddade miljöinställningar. Ingen nyckel ska finnas i källkod, klientkod eller chatt.
- `ANAMNES_THERAPIST_EMAILS`: e-postadresser till befintliga adminkonton som får läsa underlagen. Vanliga elever och administratörer utanför listan kan inte läsa dem.
- `ANAMNES_SUBMISSION_PRIVACY_NOTICE`: verksamhetens riktiga information för inskickade självtester **och** anamneser, med ansvarig verksamhet, ändamål, kontaktväg, åtkomst och lagring/radering. Självtestet visar dessutom en egen versionsbunden beskrivning av vad som skickas.
- `ANAMNES_RETENTION_DAYS`: 1–90 dagar, standard 30. Gäller nya underlag.
- Befintliga granskningsflaggor och `ANAMNES_SUBMISSIONS_ENABLED=1` måste vara korrekt konfigurerade enligt [anamnesens driftsättningsguide](anamnes-v2-setup.md). Inga tidigare granskningar intygas eller aktiveras automatiskt av denna kodändring.

Vercel behöver en ny deployment efter ändrade miljövariabler. AI-inställningar, AI-modell och Resend påverkar inte möjligheten att skicka ett självtest. Om inskickning är avstängd finns resultatet kvar för besökaren, men inget kontaktformulär eller fungerande skickaknapp visas.

## Lagring och radering

Schemat uppgraderas additivt från version 11 till 12 med tabellen `self_test_cases`. Befintliga anamneser och krypteringsformatet ändras inte. Kontaktuppgifter, frågor, svar, resultat och inskickningsinformation krypteras tillsammans med AES-256-GCM och separat postidentifiering. Bara slumpmässigt ID och datum lagras som okrypterad metadata.

Självtestets fem faspoäng räknas om från de 40 svaren på servern. Klienten kan inte skicka ett påstått poängresultat. Kontaktuppgifterna sparas inte i självtestets localStorage. Anamnesen behåller befintligt stöd för serverberäknad regelrapport eller verifierad, serverutfärdad AI-rapport; inskickning gör inget extra AI-anrop.

Underlaget blir oåtkomligt efter slutdatum och rensas vid ärendehantering. Den befintliga skyddade endpointen `GET /api/anamnes/retention` rensar båda typerna, även med tillhörande anamnesbedömningar. Den kräver befintlig `CRON_SECRET`. Inget schemalagt jobb läggs till automatiskt. Följ samma dokumenterade rensnings-, backup- och nyckelrutin som för anamneser.

## Lokal verifiering

`node --import=tsx --test tests/intake-submissions.test.ts tests/intake-submissions-ui.test.ts`

Databastesterna använder endast en egen temporär SQLite-databas och påhittade uppgifter. Extern AI, e-post och produktionsdatabas är frånkopplade. Testerna omfattar samtycke och kontaktvalidering, serverberäknat resultat, kryptering, behörighet, gamla anamnesposter, databasuppgradering, radering, utgångna underlag och HTTP-skydd.
