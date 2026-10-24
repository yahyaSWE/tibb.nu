# Anamnesoptimering och egen kvalitetsgranskning

## Besökarens flöde

1. Egen berättelse och vanliga kompletteringsfält.
2. Samma åtta trygghetsfrågor som tidigare. Alla befintliga säkerhets- och integritetsspärrar gäller före varje externt anrop.
3. I AI-läge föreslås upp till 20 strukturerade tolkningar. Varje tolkning måste använda ett befintligt publikt fråge-ID, ett giltigt svarsalternativ och ett ordagrant citat ur ett tillåtet textfält. Säkerhetsfrågor, medicinuppgifter, pensionerade frågor och puls kan inte extraheras.
4. Besökaren bekräftar varje tolkning med en från början tom kryssruta och kan rätta alternativet. Osäkerhet och motsägelser visas utan förvalt svar. Hela steget kan hoppas över. Först bekräftelsen lägger svar i den vanliga svarskartan. Styrka och frekvens behålls i de befintliga kompletteringsfälten och AI:s samtalskontext; inga nya poängkriterier uppfinns för dem.
5. Följdfrågorna prioriterar saknade kärnfynd och skillnader mellan upp till tre konkurrerande hypoteser. Okända och avböjda svar upprepas inte. Bekräftade tolkningar kan tas bort eller rättas; ändrad källtext återkallar berörda tolkningar. Orelaterade kompletteringar raderar inte andra bekräftelser.
6. Oberoende mönsteranalys sker före formeljämförelse. AI väljer fortfarande inga produkter och får ingen formelkatalog.

Vid utebliven extraktion kan besökaren svara manuellt. Vid uteblivet AI-svar fortsätter befintligt lokalt reservläge med det nya frågevalet. Inga svar eller kontaktuppgifter sparas automatiskt. Befintlig frivillig inskickning, kryptering och tidsbegränsning gäller. Bekräftelsernas ursprung följer med i kopierad sammanfattning och behandlarunderlaget; analyskvittot binder både svar och ursprung.

Extraktionen tillför ett separat leverantörsanrop, inom befintlig klientbegränsning och gemensam AI-kvot. Den nya AI-kontraktsversionen kräver ett nytt aktivt val för påbörjade sessioner. Ingen verklig patienttext eller leverantörsnyckel behövs för regressionstesterna.

## Heuristiker och oförändrade gränser

- `analyzePatternsBaseline` och `getInterviewCompletionQuestionIdsBaseline` behåller tidigare algoritmer för jämförelse. Baslinjen är dokumenterad i `anamnes-optimization-baseline.md`.
- `assessment.ts` beräknar känt/okänt kriterieunderlag, stödvikt, motfyndsvikt, saknade/motsagda kärnfynd och normaliserat stöd. Standardpolicyn förstärker kärnfynd med 1,5, dämpar generella frågor om energi/sömn/emotion till 0,5 och förstärker motfynd med 1,25. Parametrarna är Zod-validerade och kan ändras centralt eller ges till analysfunktionen.
- Det normaliserade indexet är stöd minus motvikt dividerat med mönstrets möjliga stödvikt. Det är ingen sannolikhet eller kliniskt validerad skala. Indexet används för vilka hypoteser som behöver skiljas åt, inte för att på egen hand godkänna ett mönster.
- Kvalificeringens sex kända symtomsvar, tre stödfynd, sju råpoäng, motvikt under fem samt samtliga kärn-/komponentgrupper är oförändrade. Även huvudmönster och kataloggränser bevaras tills granskade fall ger stöd för förändring. Uppdateringen påstår därför ingen bevisad förbättring av diagnostisk precision.
- `supported_pattern`, `conflicting_evidence` och `insufficient_evidence` finns per mönsterbedömning. Rapportens äldre statusfält behålls för kompatibilitet med lagrade ärenden.
- Alla 30 mönster har komponentetiketter. De sammansatta profilerna för Qi/Fukt/Kyla/stagnation, Qi/Blod/Yang, stagnation/stas/Hetta och Njure-Yang/Bi visar dessutom delkomponenternas ursprungliga kärngrupper separat. Övriga etiketter godkänner inte en komponent oberoende av mönstret. Samtidigt kvalificerade mönster finns kvar i rapportens differentiering.
- `diagnosticInformationGain` är en ordningsheuristik: skillnader mellan hypotesernas accepterade värden väger 5, saknade kärnkomponenter 4, viktiga motfynd 3 och otillräckligt undersökt stöd 2. Bakgrund och riktade smärtfrågor går först. AI får se rangordning, kriterier, faktiska fynd och osäkerhet; servern filtrerar valen.
- Inledningsvis kan egen text identifiera en annan del av frågebanken. När konkurrerande hypoteser framträder begränsas AI-valen till frågor som kan klargöra dem. Alltid högst tre frågor per anrop.
- Stopp sker när användbara frågor är uttömda, med preliminärt stöd eller uttrycklig osäkerhet. Rent bekräftande frågor dämpas efter den inledande kartläggningen. 15–25 symtomfrågor är ett mjukt mål; saknade relevanta kärnfynd och trygghetsfrågor går före antal. Ingen ny absolut patientgräns införs.

## Dina 50 granskningsfall

Öppna **Admin → Anamnes → Kvalitetsfall och egen granskning**. Kontot måste vara administratör och omfattas av befintliga `ANAMNES_THERAPIST_EMAILS`.

Läs berättelsen och samtliga skriptade svar. Uppgifter som saknas är okända. Välj förväntad status, samtliga underbyggda mönster och skriv en motivering. Bekräfta sedan din självständiga granskning. Tidigare motor, nytt frågeval och tekniskt konstruktionsmål ligger hopfällda så att du kan bedöma fallet först. Resultatet är ditt godkända facit, inte en oberoende klinisk validering av modellen.

Granskningar sparas i `app_meta`, bundna till datamängdens version, fall-ID, granskare, tid och revision. Samtidiga ändringar upptäcks. Inga patientsvar finns i dessa fiktiva fall och ingen databasändring behöver köras manuellt. Gamla patientärenden behåller sina originalrapporter.

`quality-cases.ts` har 30 konstruerade profiler och 20 närliggande, motstridiga, ofullständiga eller föränderliga varianter. De bygger delvis på befintliga regler: deras konstruktionsmål är inte expertfacit. Lägg till fler poster för 100+ fall och byt datamängdsversion när underlagen ändras. Även kliniskt oberoende fall behövs senare för att undvika att en modell enbart prövas mot sina egna konstruktionsregler.

## Lokalt uppmätt resultat

Kör `npm run anamnes:quality`, eller lägg till `-- --cases` för resultat per fall. Kommandot gör inga nätverksanrop och läser inte produktionsdatabasen. Adminvyn kompletterar samma jämförelse med dina aktuella granskningar.

| Mått i 50 fiktiva lokala simuleringar | Tidigare flöde | Adaptivt flöde |
| --- | ---: | ---: |
| Median symtomfrågor | 20 | 15 |
| Min–max symtomfrågor | 15–32 | 11–21 |
| Upprepade fråge-ID:n | 0 | 0 |
| Avstår från mönsterslutsats | 15 | 13 |
| Huvudslutsats ändras mellan frågegrupper, totalt | 45 | 44 |
| Proxy för frågor med lågt särskiljande värde, totalt | 712 | 411 |

Åtta trygghetsfrågor och fyra bakgrundsfrågor räknas separat. Skriptade motsvarande svar återanvänds, exempelvis ”svårt att somna” för en fråga om insomning; andra saknade svar blir ”Vet inte”. Simuleringen använder kodens samtliga 21 referenser, inte produktionskatalogens eventuella ändringar. Kortare flöde är inte i sig bättre precision; färre avståenden kan vara bra eller dåligt och måste granskas.

Alternativa val bland tillåtna frågor gav samma status och uppsättning kvalificerade mönster i 50/50 fall. Det testar lokal känslighet för frågeval och kompletteras med isolerade tester av olika leverantörssvar och fel. Det är inte ett prov mot en verklig Claude-version, med alla tänkbara beskrivningar eller med verkliga patienters tolkning av frågorna.

Vid implementationen finns **0 godkända facit**. Expertöverensstämmelse visas därför som ej utvärderad, inte som 0 eller 100 procent. Efter dina granskningar visas exakt status-/mönsteröverensstämmelse för respektive motor på endast de granskade fallen. Testerna bevisar tekniska egenskaper, inte medicinsk effekt, korrekt diagnos eller lämplig örtbehandling.
