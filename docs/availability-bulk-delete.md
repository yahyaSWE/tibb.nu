# Markera och ta bort filtrerade tider

Under **Admin → Tillgängliga tider → Kommande tider** finns kryssrutor för obokade tider. Kryssrutan i tabellhuvudet väljer obokade tider på den aktuella sidan. **Markera alla filtrerade** väljer alla obokade tider som matchar behandlare, månad och datumintervall, även på andra sidor.

Markeringen följer med när du bläddrar. Ändras ett filter eller återställs filtren rensas markeringen. Endast markerade tider som fortfarande matchar de aktuella filtren och listan skickas vid borttagning. **Rensa markering** avmarkerar allt.

**Ta bort markerade** öppnar en bekräftelse med antalet valda tider. **Ja, ta bort … tider** utför borttagningen. Tider arkiveras på samma sätt som vid enskild borttagning; bokningshistorik och spärrperioder finns kvar.

Servern kräver adminbehörighet och kontrollerar urvalet på nytt i en skrivtransaktion. Bokade tider, inklusive andra tider som överlappar en bokning hos samma behandlare, behålls. Om en vald tid har hunnit bli bokad, passerat eller redan tagits bort visas antalet överhoppade tider efteråt. SQL-anrop delas upp i mindre grupper inom samma transaktion.

Inga nya miljövariabler eller schemaändringar behövs. `tests/availability-bulk-delete.test.ts` verifierar flera SQL-grupper, behörighet, historik, spärrar, gamla urval och samtidig bokning/borttagning i en isolerad lokal databas.
