# Anslut e-post till Tibb.nu

Förberett 2026-10-08. Ingen extern tjänst har anslutits och inga verkliga meddelanden har skickats under utvecklingstesterna. Tibb.nu använder Resends HTTPS-API direkt; ett ytterligare SDK-paket behövs inte.

## Konfigurera avsändaren

1. Ägaren öppnar sitt Resend-konto och lägger till en domän som verksamheten kontrollerar. Följ Resends egna DNS-poster för SPF och DKIM och invänta status **Verified**. Ange inga påhittade DNS-värden. Resends avsändarverifiering skapar inte automatiskt en inkorg för verksamhetens kontaktadress.
2. Kontrollera separat att den riktiga kontaktadressen tar emot mejl och att besökare kan få svar. Webbplatsens egen domän och HTTPS behöver fungera innan den används i länkar. Använd den befintliga Vercel-adressen tills den egna domänen är ansluten.
3. Skapa en API-nyckel för utskick med minsta lämpliga behörighet i Resend. Spara den direkt i **Vercel → Project → Settings → Environment Variables**, aldrig i chatten, Git, källkod eller en `NEXT_PUBLIC_`-variabel.

| Variabel | Innehåll |
| --- | --- |
| `RESEND_API_KEY` | Hemlig API-nyckel från verksamhetens Resend-konto. |
| `EMAIL_FROM` | Verifierad avsändare, exempelvis `Tibb.nu <avsandare@din-verifierade-doman>` med verksamhetens faktiska domän. |
| `APP_URL` | Webbplatsens exakta betrodda HTTPS-origin, utan underkatalog, query eller fragment. Nuvarande adress: `https://tibbnu.vercel.app`. |
| `EMAIL_NOTIFICATION_TO` | Valfri verklig administratörsadress för bokningsaviseringar; annars används kontaktadressen i Admin → Inställningar. |
| `CRON_SECRET` | Valfritt separat slumpmässigt värde med minst 32 tecken för återförsöksjobbet. |

Sätt produktionsvärden endast i **Production**. Preview ska använda separata testvärden och kontrollerade mottagare, eller sakna e-postkonfiguration. Publicera på nytt efter ändrade miljövariabler. Kopiera inga produktionsnycklar till testdatabaser eller automatiserade tester. Testerna ersätter nätverksanrop med lokala mocks.

## Verifiering och återställning

Registrering skapar ett overifierat elevkonto. Nya kurstilldelningar kräver att eleven äger e-postadressen. Tidigare elever blir inte automatiskt verifierade vid databasuppgraderingen; deras redan tilldelade kurser och framsteg bevaras. Administratörens vanliga inloggning fortsätter fungera.

Eleven öppnar `/verifiera-epost` och begär en länk. Länken gäller 24 timmar och kräver det registrerade lösenordet. Det motverkar att en annan person registrerar elevens adress och sedan får sitt lösenord godkänt genom att adressägaren klickar på ett mejl. Den som inte skapade kontot kan återta adressen via `/glomt-losenord`. Återställningslänken gäller 30 minuter; ett nytt lösenord bekräftar e-postägarskap och avslutar samtliga tidigare sessioner.

Endast tokenhashar lagras. De tre senaste länkarna per användare och länktyp kan vara giltiga samtidigt; ett återförsök eller osäkert nätverkssvar förstör därmed inte ett nyss levererat mejl. När en länk används förbrukas alla kontots länkar atomiskt. En vanlig sidvisning förbrukar inte token. Dela aldrig dessa privata länkar och undvik att klistra in dem i supportloggar.

Lösenordsåterställning ger samma svar för kända och okända adresser innan kontouppslag/utskick körs. Svaret bekräftar varken kontots existens eller leverans. Saknad serverkonfiguration ger däremot ett tydligt fel för alla adresser; inga konton verifieras och ingen leverans påstås.

## Bokningsmejl och återförsök

En bekräftad bokning med betalning på plats lägger kundbekräftelse och eventuell administratörsavisering i databasens outbox. En Stripe-reservation gör det först efter verifierad betalning. Väntande eller avbokade bokningar skickar inte bekräftelser. Ämne och text innehåller tid och skyddade länkar, men inga behandlingsnamn, kundnamn, telefonnummer eller hälsouppgifter. Kundens bokningslänk ger tillgång till bokningsuppgifter: behandla den som privat.

Första utskicket startas automatiskt efter bokning eller betalningswebhook. Admin visar väntande/under behandling/accepterat/misslyckat/överhoppat och kan behandla väntande jobb. **Accepterat** betyder att Resend accepterat API-anropet, inte att mottagarens inkorg eller leverans har verifierats. Kontrollera leverans, studs och avvisning i Resend.

Varje jobb har ett beständigt idempotensvärde och en atomisk arbetsreservation. Osäkra svar kan återförsökas med samma avsändare, mottagare och innehåll. Högst fem försök tillåts, med ökande väntetid, inom 23 timmar från första försöket. Därefter stoppas jobbet för att inte överskrida Resends 24-timmarsfönster för idempotens och skapa dubbletter. Kontrollera Resend innan ett stoppat utskick hanteras manuellt; den vanliga återförsöksknappen nollställer inte gränserna.

Ett schemalagt jobb är **inte aktiverat automatiskt**. Efter att tjänsten anslutits kan ägaren konfigurera Vercel Cron för `GET /api/email/outbox` med den hemliga `Authorization: Bearer`-header som Vercel använder för `CRON_SECRET`. Endpointen kräver minst 32 tecken, hanterar högst tio förfallna jobb och returnerar enbart räknare. Anpassa frekvensen till projektets faktiska Vercel-plan; kontrollera jobbets status och begränsningar i dashboarden. Vercel Hobbys dagliga cron räcker inte säkert för återförsöksfönstret på 23 timmar; se [driftguiden](operations.md) för alternativ. Utan schemaläggning behandlar admin väntande återförsök manuellt.

## Kontroller före skarp användning

- Verifiera avsändardomän, riktig inkorg, API-behörighet och både inkorg/skräppost med en kontrollerad mottagare.
- Testa registrering, länk + lösenord, fel/utgången/använd länk, återställning och utloggning av en gammal session.
- Testa en kontrollerad bokning på plats, kundens privata länk och adminavisering. Kontrollera att avbokning stoppar väntande mejl.
- Om kortbetalning senare aktiveras: testa Stripe separat och kontrollera att endast betald/bekräftad bokning aviseras.
- Dokumentera faktiska leverantörsavtal, överföringar och lagring i verksamhetens integritetsbedömning. Inga nya lagringstider eller rättsliga grunder har antagits här.

Officiella källor: [Resend: verifierade domäner](https://resend.com/docs/dashboard/domains/introduction), [Send Email API](https://resend.com/docs/api-reference/emails/send-email), [idempotens](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel: Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
