# Distansbokningar

Välj **Admin → Behandlingar → Besöksform → Distans · digitalt möte** när du skapar eller redigerar en behandling. Besöksformen visas på bokningssidan och i sammanfattningen. Tider, behandlare och betalning hanteras som för övriga besök.

Efter en bokning väljer du **Admin → Bokningar → Visa bokning → Distansmöte**. Klistra in en HTTPS-länk från din mötestjänst och välj **Spara möteslänk**. Länken kan bytas eller tas bort genom att spara ett tomt fält. Systemet skapar inte möten hos en extern mötesleverantör.

Kunden hittar länken på sin privata bekräftelsesida, som också länkas från det ordinarie bokningsmejlet. Att spara eller ändra länken skickar inget nytt mejl. Kunden får därför instruktionen att spara bokningssidan och återkomma före mötet.

Möteslänken visas endast för bekräftade distansbokningar. För Stripe krävs även registrerad betalning. Avbokade eller genomförda bokningar visar ingen möteslänk. Behörig admin kan lägga till länken under en pågående betalningsreservation; den visas först efter bekräftad betalning.

På bekräftelsesidan och i nya bokningsmejl finns en påminnelse att skicka anamnesen minst 24 timmar före mötet, med en länk till formuläret. Sidan visar en deadline i svensk tid. Vid bokning med mindre än 24 timmars framförhållning uppmanas kunden att skicka så snart som möjligt. Bokningen blockeras inte av påminnelsen, och anamnesen skickas fortfarande genom ett separat aktivt val i formuläret.

## Databas

Schema 13 lägger till `treatments.delivery_mode`, `bookings.delivery_mode` och `bookings.meeting_url`. Befintliga behandlingar och bokningar får `onsite` och tom möteslänk. Besöksformen kopieras från behandlingen vid bokning; senare ändringar av behandlingen ändrar inte redan bokade besök. Möteslänken lagras endast på den enskilda bokningen och ingår aldrig i den publika behandlingskatalogen.

Uppgraderingen sker i den befintliga transaktionen för databasinitialisering. Den kräver inga nya miljövariabler. För bekräftelsemejl behövs den befintliga Resend-konfigurationen.

## Verifiering

`tests/remote-booking.test.ts` prövar besöksformens historik, adminbehörighet, URL-validering, ändring/radering av möteslänkar, kundvyer före och efter betalning/avbokning samt 24-timmarsgränsen över svensk tidsomställning. `tests/remote-booking-migration.test.ts` prövar uppgradering från version 12 och upprepad initialisering utan ändrad historik. Externa betalningar, mötestjänster och mejlleveranser anropas inte av dessa tester.
