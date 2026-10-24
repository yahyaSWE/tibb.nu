# Utgångsläge för anamnesoptimering – 23 oktober 2026

Jämförelsebas: `10de8ea`, före optimeringen. Den separata säkerhetsuppdateringen till Next.js 16.4.2 påverkar inte mönsterreglerna.

- 80 frågeposter: 78 publika, en pensionerad bakgrundsfråga och en professionell pulsfråga. Åtta trygghetsfrågor besvaras före extern AI. Okända/avböjda säkerhetssvar spärrar fortsatt extern analys.
- 30 oberoende mönster. Varje kriterium har fråge-ID, accepterade värden och vikt 1–5. Stöd och motfynd räknas en gång per faktiskt ursprungssvar, även om motsvarande frågor täcks av ett bredare svar.
- Baspoängen är `max(0, stödvikter − motvikter)`. Kvalificering kräver minst sex kända symtomsvar, tre stödfynd, sju poäng, motvikt under fem och samtliga kärn-/komponentkrav. Alla komponentgrupper krävs, men alternativen inom en grupp är ELLER-villkor.
- Rangordningen använder råpoäng. Huvudmönster kräver minst två poängs försprång. Motsägelser och otillräckligt underlag kan ge tom huvudbedömning.
- Claude får berättelse, tillåtna kompletteringar, bekräftade strukturerade svar, frågebank och mönsterregler. AI får returnera mönster-/fråge-ID:n och tillräcklighet, men inte fri diagnos-/produktprosa. Servern filtrerar alltid förslagen. Formelkatalogen skickas inte till AI.
- Intervjun väljer upp till tre frågor per omgång och tar även in generella kärnfrågor, relevanta skillnader och katalogens nödvändiga mot-/säkerhetsfrågor. Avslut sker när relevanta frågor är uttömda eller besökaren väljer att avsluta. Någon patientgräns på exempelvis 30 frågor finns inte.
- Efter oberoende mönsteranalys jämförs 21 aktiva referenser (10 ordinarie och 11 specialbeställningar). Högst tre kan visas; säkerhets- och produktverifiering överordnas poäng. Aktuell medicinering kräver separat terapeutgranskning men stoppar inte ensam mönsteranalys eller referenser.

## Mätning före tröskeländring

De befintliga kvalificeringsgränserna behålls som konservativ grund. Normaliserat stöd, kriterietäckning, komponenter och frågornas särskiljande värde ska redovisas separat. Interna index är inte kliniska sannolikheter.

Tekniska regressionsexempel får dokumentera kodens förväntade beteende men räknas inte som expertfacit. Ägaren har valt att själv granska de nya fiktiva fallen. Expertöverensstämmelse ska därför endast beräknas på uttryckligen granskade, versionsbundna facit; innan sådana finns anges ”inte utvärderat”. Någon förbättrad klinisk precision får inte påstås från enbart dessa tester.
