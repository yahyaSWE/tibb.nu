# Tibb.nu – drift, kontoåterställning och säkerhetskopiering

Den här guiden förbereder rutiner. Den innebär inte att produktionsbackup, återställning, avsändardomän eller e-postleverans redan har testats. Använd en separat testmiljö för övningen och anteckna resultat innan kundlansering.

## Daglig kontroll

Öppna Admin → Bokningar och kontrollera nya bokningar och deras betalningsstatus. Betalning på plats bekräftas utan Stripe; markera betalning först när den mottagits. Kontrollera bokningsmejl i varje bokning. ”Accepterat av Resend” beskriver API-mottagning; leverans eller studs kontrolleras i Resend.

Misslyckade utskick ligger i databasen. Admin kan behandla väntande utskick. Automatiska återförsök behöver en scheduler som anropar den skyddade `/api/email/outbox` regelbundet med `Authorization: Bearer <CRON_SECRET>`. Följ [e-postguiden](email-setup.md). Vercel Hobby tillåter högst daglig cron, vilket inte räcker säkert för applikationens återförsöksfönster på 23 timmar. Tätare Vercel-cron behöver annan plannivå; en extern scheduler är också möjlig. Ingen betald tjänst eller scheduler har aktiverats här. [Vercels cronbegränsningar](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Kontoåterställning

Med Resend anslutet använder admin och elever ”Glömt lösenord” på inloggningssidan. Länken gäller 30 minuter och används en gång. Återställning avslutar alla tidigare sessioner, verifierar ägarskapet till e-postadressen och bevarar roll, kursåtkomst och framsteg.

En elev verifierar sin adress i elevportalen innan ny kursåtkomst tilldelas. Om någon registrerat elevens adress först ska adressägaren använda lösenordsåterställning. Bekräfta inte ett okänt konto med någon annans lösenord.

Om e-post eller databasen är ur funktion: återställ anslutningen först. Återskapa inte databasen, radera inte adminkontot och använd inte `/setup` som lösenordsåterställning. `SETUP_TOKEN` behövs bara innan första admin har skapats. Förvara serverhemligheter i en lösenordshanterare och i Vercels miljövariabler, aldrig i Git eller supportmeddelanden.

## Vad en full backup behöver innehålla

- Databasen: bokningar, konton, enrollments, framsteg, aktiviteter/svar, artiklar, scheman, inställningar, villkorssnapshot och filmetadata.
- Filinnehåll från den privata Blob-lagringen: PDF/Word-material och behandlarbilder. Databasens filmetadata innehåller inte själva filerna.
- En manifestfil med varje objektets ursprungliga `storage_path`, storlek, kontrollsumma och backupdatum. Bevara även motsvarande kodversion och en separat skyddad förteckning över miljöinställningar.

Utse en ansvarig och besluta frekvens, lagringstid och godtagbar dataförlust. En praktisk start är daglig backup samt backup före migreringar och större innehållsrensning. Använd krypterad lagring med begränsad åtkomst och en separat kopia. `backups/` och `.test-data/` är undantagna från Git och Docker; det ersätter inte kryptering eller åtkomstkontroll.

## Turso: export och återställning

Kontrollera databasnamn och abonnemang i Turso. Point-in-time recovery skapar en **ny** databas från en befintlig. Tillgängligt tidsfönster beror på plan; utgå inte från att en raderad databas kan återställas på samma sätt. En återställd databas behöver sin egen anslutning och token. [Tursos PITR-guide](https://docs.turso.tech/features/point-in-time-recovery).

Exempel med Turso CLI, efter inloggning i rätt konto. Byt exemplens namn och datum till verifierade värden. Dessa kommandon har inte körts mot produktion:

```powershell
turso db shell DIN-DATABAS .dump > "C:\SKYDDAD-BACKUP\database.sql"
turso db create NY-TEST-DATABAS --from-dump "C:\SKYDDAD-BACKUP\database.sql"
```

SQL-dumpen kan användas för återuppbyggnad. Kontrollera exportens exitkod och att filen är komplett. [Turso db shell](https://docs.turso.tech/cli/db/shell), [Turso db create](https://docs.turso.tech/cli/db/create).

Alternativt kan en tidpunkt återställas:

```powershell
turso db create NY-TEST-DATABAS --from-db DIN-DATABAS --timestamp 2026-10-08T08:00:00Z
```

`turso db export` kan ge en SQLite-snapshot som saknar de allra senaste ändringarna; använd inte en sådan fil som bevis på aktuell backup utan att hantera synkningen. [Turso db export](https://docs.turso.tech/cli/db/export).

För lokal SQLite: använd SQLite backup API eller en konsekvent snapshot. Kopiera inte bara en aktiv `.sqlite`-fil och ignorera WAL-filen.

## Privata filer och återställningsövning

Gör en sammanhängande kopia av databas och filer under ett överenskommet skrivstopp för bokning/innehåll/uppladdning. Hämta privata objekt med behörig serveråtkomst. SDK:t erbjuder paginerad `list`, privat `get` och `put` med `access: "private"`. Bevara originalets namn, innehållstyp och kontrollsumma. [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk).

Återställ till en separat databas och privat Blob-store. Ett byte av store ger andra objektadresser: uppdatera därför kopians `uploads.storage_path` med manifestets verifierade mappning. Kontrollera även `upload_requests` och eventuella bildreferenser. Ändra inte produktionsmetadata under övningen.

Testmiljön ska sakna skarpa Stripe- och Resend-nycklar, använda egen `APP_URL` och vara skyddad från indexering/obehöriga besök. Rensa sessioner och autentiseringstokens i **kopian** och stoppa återspelning av gamla mailjobb innan den startas. Minimera persondata i en bestående testmiljö. Konton i produktionsbackup ska inte ge åtkomst till en offentligt nåbar testserver.

Verifiera admininloggning, artikel/kurs, en privat PDF och bild, quizhistorik, elevframsteg, kommande tider samt boknings-/betalningssnapshots. Jämför radantal och filkontrollsummor. Dokumentera backupdatum, återställd kodversion, förlorade ändringar och vilka kontroller som passerade. Byt produktionsanslutning först efter en godkänd separat övning och bevara den gamla databasen tills övergången har kontrollerats.

## Övergivna uppladdningar

Använd städverktygets dry-run och granska kandidater innan någon rensning tillämpas. Det ska endast hantera applikationens kända kursmaterial, aldrig generella mappar eller behandlarbilder. Metadata, pågående uppladdningar och lektionskopplingar måste kontrolleras på nytt inför radering. Metadatalösa filer behöver extra kontroll av att databasen och Blob-lagringen verkligen hör ihop.

```powershell
npx tsx scripts/uploads-cleanup.ts --help
npx tsx scripts/uploads-cleanup.ts --provider blob
```

Standard är en skrivskyddad genomgång med sju dygns skyddsperiod och högst 200 kandidater. `--apply` gör rensningen, `--grace-hours` får inte understiga 24. Metadatalösa filer är endast rapporter tills både `--apply --include-storage-orphans` anges och minst en refererad kursfil matchar i databas och lagring. Det är ett skydd mot uppenbart fel par, ingen garanti om lagringen delas av flera installationer. Använd en dedikerad store och granska varje kandidat. Om alla kurser har raderats saknas referens för parkontrollen och dessa filer lämnas kvar för manuell granskning.

Verktyget läser lokala miljöinställningar och kräver befintlig databas. Rapporten innehåller objekt-ID och lagringssökväg men inga nycklar eller filnamn. Färska DB-kontroller skyddar lektionskopplingar och pågående uppladdningar; Blob-radering använder ETag. Om lagringsradering misslyckas kan filen bli kvar efter att övergiven metadata tagits bort. Granska rapporten och inventera igen innan nästa åtgärd. Ingen produktionsrensning har körts.

Ta en verifierad backup först. Rensning av gamla filer och rättighetsbegäran om personuppgifter är olika rutiner; den här filstädningen inför ingen automatisk GDPR-lagringspolicy.
