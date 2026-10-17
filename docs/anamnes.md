# Anamnes inför rådgivning

`/anamnes` är öppen utan inloggning och nås från **Självtest & anamnes** och
sidfoten. Det tidigare självtestets frågor och poängmodell är separata.

## Flödet

Frågebanken innehåller 78 frågor, varav en pulsfråga endast är avsedd för
behandlarobservation. I poängläget får besökaren normalt 23–29 grundfrågor efter valt fokus
och högst fem följdfrågor. Tidigare besvarade frågor finns kvar för granskning
om fokus ändras. Okända och undanhållna svar behandlas aldrig som nekande fynd.

Analysen jämför svaren med 25 oberoende TCM-mönster innan den aktiva
formelkatalogen används i matchningen. Rapporten visar stödjande fynd,
motfynd, saknade uppgifter, Ba Gang och Zang-Fu. Otillräckliga eller
motstridiga svar ska kunna ge ett resultat utan primär hypotes och utan
formelmatchning. Modellen är heuristisk och inte kliniskt validerad.

Katalogen startar med de tio formler som verksamheten angett. Högst tre
rangordnade klassiska referenser visas, med förklaringar och begränsningar.
Referenser är aktiverade som standard. Ett tydligt resultat utan matchning
är tillåtet. Produktidentitet, faktiskt innehåll, säkerhetsunderlag och
regulatorisk status är overifierade i startkatalogen. Ingen produkt kan
visas som tillgänglig förrän allt verifierats och en publicerad produkt
har kopplats. Formler kan ändras och inaktiveras i `/admin/anamnes/formler`.

Ingen diagnos, automatisk örtordination, individuell dosering eller
direktköpsrekommendation skapas. Säkerhetsspärrar fungerar utan AI och
stoppar referenser vid bland annat akuta symtom, ofullständiga säkerhetssvar,
graviditet, minderårighet, medicinering och relevanta sjukdomsuppgifter.
Bokningsknappen förmedlar inga formulärsvar till bokningen.

## Integritet och val

Standardläget analyserar svaren i webbläsarens React-minne. Formelkatalog och
funktionsstatus hämtas från servern utan formulärsvar. Svar skrivs inte till
URL, cookies, `localStorage` eller `sessionStorage`. Knappen **Rensa svar och
börja om** rensar formuläret. En omladdning rensar tillståndet, men att lämna
sidan garanterar inte rensning eftersom webbläsarhistoriken kan återställa den.
En kopia i urklipp rensas inte av formulärets återställning.

I AI-läget kan besökaren först skriva en egen beskrivning på högst 4 000 tecken.
Efter åtta trygghetsfrågor väljs upp till tre relevanta frågor i taget.
Besökaren kan komplettera texten och avsluta med det underlag som finns.
AI kan avsluta tidigare när bekräftade svar räcker; högst fem frågeomgångar
och en slutanalys tillåts. Fritexten väljer inte åt besökaren och räknas inte
som bekräftade symtom. Text med möjliga säkerhetsförhållanden kan spärra AI
och formler; ordkontrollen kan inte avgöra aktualitet eller negation.

Extern AI och inskickning till behandlare är separata funktioner som är
avstängda som standard. De kräver serverkonfiguration, dokumenterad granskning,
aktuell integritetsinformation och besökarens uttryckliga separata val.
Admin väljer poängbaserad eller AI-assisterad anamnes på `/admin/anamnes`.
Valet sparas i databasen och standard är poängbaserad. Poängläget spärrar även
nya AI-anrop från redan öppnade formulär. AI-läget kräver fortfarande alla
serverinställningar och samtycke; annars används poängmodellen.
AI får strukturerade formulärsvar men ingen produktkatalog. Vid särskilt samtycke omfattar AI-underlaget
även den egna beskrivningen och eventuella kompletteringar. Bara bekräftade
svar får stödja mönsterpoängen. Endast tillåtna
mönster- och fråge-ID:n accepteras; fri modelltext visas inte. Servern
kontrollerar resultatet, och vid fel används regelanalysen. `store:false`
är inte ett löfte om att leverantören saknar egen lagring eller loggning.

Vid uttrycklig inskickning sparas svar, egen beskrivning, kontaktuppgifter, rapport och
samtyckesunderlag krypterat under en begränsad tid. En signerad AI-rapport kan
sparas utan ett nytt AI-anrop. Ogiltiga eller utgångna signeringar avvisas.
Regelrapporter räknas om med aktuell katalog vid inskickning. Endast uttryckligen
behöriga administratörer i behandlarlistan får läsa ärenden. Behandlarens
noteringar, korrigeringar och slutliga bedömning är separata från originalet.

Sidan och de skyddade vyerna har `noindex`, `nofollow` och `noarchive`;
anamnesen finns inte i sitemap. Hälsouppgifter ska aldrig loggas i vanliga
applikationsloggar. Administrativa ärenden och API-svar använder `no-store`
och `no-referrer`. Dessa inställningar ersätter inte autentisering.

## Aktivering, granskning och verifiering

Se [driftsättningsguiden](anamnes-v2-setup.md) för miljövariabler, AI-konfiguration,
lagringsnyckel, behandlarbehörigheter, retention och kontroll inför produktion.
Klinisk granskning av frågorna, reglerna och formlerna, dataskyddsbedömning
och bedömning av medicinteknisk mjukvara återstår innan sådan användning.
Tekniska aktiveringsflaggor är inga juridiska godkännanden.

Använd syntetiska svar för utveckling. Kör `npm test`, `npm run typecheck`
och den isolerade build-wrappern. Webbläsarkontrollen ska omfatta mobil och
dator, akut avbrott, osäkra svar, ändrat fokus, följdfrågor, no-match,
återställning och katalogändringar. Standardläget får inte skicka hälsosvar
över nätverket. Aktiverade funktioner ska dessutom testas med separata
syntetiska samtycken, behörigheter och radering. Se den ignorerade lokala
previewns README för isolering från riktiga nycklar och databaser.

Allmän säkerhetsinformation finns hos
[1177](https://www.1177.se/undersokning-behandling/fler-behandlingar/alternativa-behandlingar/vaxtbaserade-lakemedel-och-naturlakemedel/)
och [NCCIH](https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know).
Dessa källor validerar inte den här modellens regler eller resultat.
