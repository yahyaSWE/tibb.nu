# Tibb.nu – åtgärder efter lanseringsgranskningen

2026-10-08. Ändringarna nedan är implementerade och verifierade lokalt. Kontrollerna använde separata testdatabaser och gjorde inga manuella ändringar i produktionsinnehållet. Efter publicering återstår kontroll av databasuppgraderingen och de externa tjänsterna enligt listan nedan. [Den ursprungliga granskningen](launch-review-2026-10-08.md) beskriver läget före dessa åtgärder.

## Genomfört

- Admin → Inställningar har verksamhets- och villkorsinställningar med **Joart Group AB, 559363-3893**, **24 timmars återbud** och **kursåtkomst utan tidsgräns** som angivna grundvärden. Ingen avgift för sent återbud har hittats på. Kontakt, bokningsbekräftelse, sidfot och nya `/villkor` visar relevant information. Nya bokningar bevarar de avbokningsvillkor som gällde vid bokningen; äldre bokningar får inte retroaktivt nya villkor.
- Integritetssidan beskriver bokningar, konton, quiz, skrivuppgifter, självtestets lokala lagring, cookies och externa leverantörer. Admin har fält för verklig rättslig grund, lagring och överföringar samt en påminnelse om saknade beslut. Tomma fält fylls inte med påhittade uppgifter. Automatisk gallring av boknings-/elevuppgifter ingår inte i denna ändring.
- **Resend är förberett** för e-postverifiering, lösenordsåterställning och bokningsaviseringar. Verifierad elevadress krävs för ny kurstilldelning; äldre tilldelningar och framsteg bevaras. Återställning bevarar rollen och avslutar tidigare sessioner. Tokens hash-lagras, löper ut och förbrukas atomiskt. GET-visningar förbrukar inga tokens. Återställningssvaret avslöjar inte om ett konto finns.
- Bokningsmejl har en beständig kö, deduplicering, begränsade återförsök och status i admin. Utskick sker först för bekräftade bokningar. Kundnamn, behandlingsnamn och hälsouppgifter ingår inte i mejltexten. "Accepterat av Resend" bekräftar API-mottagning och innebär inte verifierad leverans. Saknad konfiguration ger ett tydligt besked.
- Administratörens artikel-, kurs- och lektionsformulär behåller inmatning och uppladdat material vid sparfel. Affärs-/kursinformationsformulär visar sparstatus och låser fälten under sparning. Elevens quiz och skrivuppgift visar sparfel, sparat utkast och osparade ändringar. Vanliga länkar, omladdning och utloggning har navigationsskydd. Webbläsarens SPA-historik och tvingad mobilstängning kan fortfarande lämna sidan utan varning: eleven uppmanas att spara uttryckligen. Ingen autosparning påstås.
- Kursbyggaren har målgrupp, förkunskaper, lärandemål och krav för genomförande. Kurskort visar en kort ingress; hela beskrivningen finns kvar på kurssidan. Artikeltext stöder `## Underrubrik` och säkra klickbara Markdown-länkar. Tre källbelagda artikeltexter och importfil finns i `docs/articles/`; importfilen markerar dem som utkast. Produktionsutkasten från den tidigare granskningen har inte skrivits över eller publicerats.
- Navigationen har aktiv sidmarkering, privata layouter har hopplänkar och långa texter kan brytas. Örepriser och Stockholm-datum bevaras. Admin påminns att ersätta det generiska behandlarnamnet med Johan Yahya Blomdahl och kan använda befintlig bilduppladdning.
- Anropsbegränsningen använder betrodda Vercel-adresser och undviker en gemensam spärr när sådan adress saknas. Stripe ignorerar signerade händelser som hör till andra tjänster, samtidigt som egna övergående fel kan återförsökas.
- Testdata och backup undantas från Docker/Git. Ett städverktyg för övergivna kursfiler har förhandsgranskning som standard, skyddsperiod, färska referenskontroller och sökvägsskydd. Behandlarbilder ingår inte. Ingen produktionsrensning har körts.

## Verifiering

**175 av 175 tester passerar**, TypeScript-kontrollen och det isolerade Next.js-produktionsbygget passerar. Produktionsberoendena hade inga kända sårbarheter vid `npm audit --omit=dev`. Inga beroenden har tillkommit.

Tester täcker bland annat migrering av befintliga konton, verifiering och tokenutgång/återanvändning, återställning av sessioner, bokningsvillkorssnapshot, mailkö och idempotens, behörighet vid innehållssparning, privata filer och rensning med samtidig filkoppling. Femton separata HTTP-kontroller mot en riktig lokal Next-server verifierade innehållsformulärens lyckade sparning, felhantering och åtkomstkontroll.

Lokal UI-kontroll verifierade verksamhetsinställningar, villkor, integritet, glömt-lösenord-länk, bokningens avbokningsinformation och att lektionsfel behåller text och PDF. Villkorssidan och admininställningarna hade ingen horisontell overflow vid 320 px; normal visningsbredd återställdes efter kontrollen. En osparad skrivuppgift visade navigationsvarningen; den öppna bekräftelsedialogen stoppade vidare automation i just den testfliken. Full kontroll av att avbryta dialogen och sedan spara i UI återstår; motsvarande händelse- och sparlogik täcks av tester. Skarpa meddelanden, betalningar och produktionsbackup/återställning har inte utförts.

## Kvar före kundlansering

1. Ange en **fungerande kontakt-e-post och verklig besöksadress** i Admin → Inställningar. Kontrollera mottagning och svar. Telefon är valfritt. Ändra behandlarprofilens namn och lägg till en bild om önskat.
2. Besluta och fyll i **rättslig grund, boknings-/elevuppgifters lagring och faktiska leverantörsöverföringar**. Granska integritet, avtalsvillkor och kursinformationen utifrån verksamhetens verkliga upplägg.
3. Anslut Resend enligt [e-postguiden](email-setup.md). Verifiera avsändare och en kontrollerad mottagare, hela verifierings-/återställningsflödet och bokningsaviseringar. Konfigurera frekventa återförsök eller bestäm manuell bevakning i admin. Ingen scheduler är aktiverad. Vercel Hobby med daglig cron räcker inte säkert för mailköns återförsöksfönster; se [driftguiden](operations.md).
4. Gör och dokumentera en **separat återställningsövning av databas och privata filer** enligt driftguiden. Kodens filstädning ersätter inte backup eller gallring av personuppgifter.
5. Granska de tre artikelutkasten, kursens samtliga videor och verksamhetens bokningstider. Kortbetalning kan fortsätta vara avstängd; innan den aktiveras behövs ett fullständigt Stripe-testflöde.
6. Efter godkänd publicering: kontrollera databasuppgraderingen, login med befintligt admin, ägarens kontrollerade bokning, privat kursfil och utskick. Koppla `tibb.nu` senare och kontrollera canonical/sitemap samt Search Console på den riktiga domänen.

## Lokala underlag

- [Verksamhetsinställningar – skärmbild](../.test-data/launch-fixes/admin-terms.png)
- [Lektionsfel behåller text och material – skärmbild](../.test-data/launch-fixes/lesson-error-preserves-material.png)
- [Slutlig testlogg](../.test-data/launch-fixes/tests-final.txt)
- [Slutlig bygglogg](../.test-data/launch-fixes/build-final.txt)

Underlag i `.test-data` ligger bara lokalt och följer inte med till Git. De använder separat testdatabas och testidentiteter.
