# Anamnes V2 – drift, förvaltning och granskning

## Vad som är implementerat

`/anamnes` är en publik, adaptiv anamnes med en separat frågebank, oberoende regelbaserad TCM-mönsterdifferentiering, säkerhetsspärrar och ett valfritt AI-steg. Därefter jämförs resultatet med den aktiva formelkatalogen. Högst tre referenser visas, med stödjande/motsägande fynd, saknade uppgifter och begränsningar. Inget passande alternativ är ett giltigt resultat.

En mönsterhypotes är inte en medicinsk diagnos. Interna poäng är inte kliniskt validerade sannolikheter. Verktyget lämnar ingen dosering, automatisk örtordination eller direktköpsrekommendation. Nästa steg är individuell konsultation. Akuta svar avbryter förloppet; ofullständiga säkerhetssvar, minderårighet, graviditet/amning, läkemedel/kosttillskott och andra riskuppgifter kan spärra formelreferenser oberoende av AI.

**Standardläget:** AI och inskickning till behandlare är avstängda. Den vanliga analysen görs i besökarens webbläsare och svar sparas inte automatiskt i databasen. Lagring av hälsouppgifter kräver ett separat uttryckligt val. Inga provider-anrop med verkliga hälsouppgifter ska användas som ett konfigurationstest.

## Beskrivning med egna ord och stegvis AI-intervju

Besökaren kan börja med en egen beskrivning på högst 4 000 tecken i båda
analyslägena. Texten stannar lokalt tills ett uttryckligt AI-val eller en
separat inskickning görs. AI-informationen visas vid startknappen; någon
separat samtyckessida används inte. Att skriva eller öppna formuläret är
inte ett AI-val. Personnummer, namn och kontaktuppgifter bör inte anges.
I poängläget fyller texten inte i några strukturerade svar, men följer med
i sammanfattningen och i ett separat inskickat konsultationsunderlag.

Åtta fasta trygghetsfrågor visas tillsammans. Därefter väljs högst tre
frågor per AI-omgång ur den granskade frågebanken. Bakgrunden omfattar
besvärsområde, varaktighet, debut och förlopp. Frågan `priorAssessment`
visas inte längre för nya besökare och är inte ett obligatoriskt villkor;
dess ID och äldre svar behålls för historiska underlag.

Frågeflödet täcker även en allmän TCM-bild: temperatur, energi, sömn, aptit,
avföring, törst, svettning, känsloliv och smärta. Besvärsspecifika frågor,
motsägande fynd och relevanta kriterier för formeljämförelse kompletterar
denna kärna. Modellens `sufficient`-signal kan inte ensam avsluta samtalet
medan relevanta granskade frågor återstår. Formelkriterier påverkar
kompletteringen först efter den oberoende mönsterdifferentieringen.

Det finns ingen fast klinisk gräns på tio omgångar. `round` är en teknisk
räknare och `finalize:true` markerar besökarens uttryckliga avslut. Annars
avslutas flödet när relevanta frågor är uttömda. Frågebanken är ändlig;
besvarade eller avböjda frågor väljs inte igen. Budget, trafikgränser och
validering gäller fortsatt och ska inte användas som kliniska slutregler.

Besökaren kan gå tillbaka, komplettera texten och avsluta med det underlag
som finns. Okända eller avböjda bakgrundssvar räknas som besvarade för
navigation, aldrig som bekräftade fynd. För en preliminär mönsterrapport
krävs fortfarande tydliga, godkända säkerhetssvar, besvarad bakgrund och
minst sex kända symtomsvar samt regelstöd för själva mönstret. Ett tidigt
avslut kan ge otillräckligt underlag utan mönster eller formelreferenser.
Ett nekat obligatoriskt mönstervillkor får inte kompenseras med allmänna
poäng, och frågeflödet ska inte tvinga fram en sortimentsmatchning.

Vid AI-fel fortsätter den pågående sessionen med lokala följdfrågor och
behåller tidigare svar, utan fler automatiska AI-försök. Ett nytt AI-val
görs från introduktionen. Rapporten sammanfattar bekräftade svar,
osäkerheter och begränsningar även när inget mönster kan väljas. Besökaren
kan välja att komplettera underlaget med relevanta obesvarade frågor
lokalt. Ett manuellt avslut eller en komplettering sänker inte
mönsterkraven eller säkerhetsspärrarna. Lokalt läge markeras tydligt även
när säkerhetsuppgifter gör att den valda AI-intervjun inte kan användas.

### Frivilliga kompletteringar inför konsultationen

`consultation` innehåller valfria uppgifter om lokalisation, intensitet
0–10, frekvens, vardagspåverkan, mål, tidigare undersökningar/behandlingar
och levnadsvanor. Varje publik fråga kan även få en kort egen kommentar.
Fälten är avgränsad, opålitlig fritext och ger inga kliniska poäng.
Besökaren kan granska dem före inskickning; behandlarvyn visar dem separat
från bekräftade svar och maskinens rapport.

Vid läkemedel/kosttillskott = ja krävs namn; dos, frekvens och anledning är
en frivillig komplettering. Positiv sjukdoms- eller lever/njuruppgift kan
kompletteras med diagnos/bakgrund, och allergi = ja med ämne och reaktion.
Detaljer som hör till en nekad eller avböjd säkerhetsgren rensas på klient
och server. Sjukdomskompletteringen behålls om antingen sjukdomsfrågan eller
lever/njurfrågan besvarats ja.

AI kan få beskrivningen, kompletteringar om besvären och kommentarer till
symtomfrågor för att välja följdfrågor. De separata läkemedelsnamnen,
`medicationDetails`, `conditionDetails`, `allergyDetails` och kommentarer
till säkerhetsfrågorna undantas från leverantörsunderlaget. Det är ingen
automatisk avidentifiering av annan fritext. Beskrivningen och
kompletteringstexterna omfattas av lokal/serverbaserad säkerhetskontroll
före eventuellt AI-anrop.

Rapportens inledande ruta visar ”Svaren lutar inom TCM-modellen åt …” endast
när den samlade analysen har ett kvalificerat primärt mönster och
säkerhetsbedömningen är tydlig. Högst tre befintliga formelmatchningar visas
som referenser att utvärdera med terapeut, med delvis överensstämmelse markerad.
Rutan skapar inga nya mönster eller formler. Vid osäkerhet, jämna alternativ,
AI-osäkerhet eller säkerhetsspärr visas ingen sådan inriktning. Terapeutens
bedömning behövs före eventuell användning. Texten följer även med i den
kopierbara sammanfattningen.

Fritexten är opålitlig data. Den kan påverka frågevalet men fyller aldrig i
formulärsvar eller skapar poänggivande symtom. Endast uttryckligen bekräftade
strukturerade svar stöder mönsterhypoteserna. Modellen får endast returnera
kända fråge-/mönster-ID:n och en indikator om underlaget räcker; inga fria
modellsvar, örtordinationer, produktförslag eller doser visas.

Fritext med möjliga varningssymtom eller säkerhetsförhållanden kan spärra AI
och formelreferenser även när strukturerade svar är nekande. Spärren är en
försiktig kontroll av omnämnanden, inte allmän språkförståelse. Endast en
snävt definierad helmening som ”Jag tar inga mediciner” eller ”Jag använder
inga läkemedel” undantas från läkemedelskontrollen. Undantag, osäkerhet,
tidigare bruk eller villkorad formulering behåller spärren. Akuta omnämnanden
bedöms fortsatt konservativt även om sammanhanget är oklart. Besökaren kan
förtydliga texten; akuta besvär ska inte hanteras genom att fortsätta formuläret.

Vid uttrycklig inskickning lagras beskrivning, läkemedelsnamn och
kompletteringar i samma krypterade ärendeinnehåll som svar och rapport.
Rapportsignaturen omfattar svar, beskrivning och normaliserade
kompletteringar, även uppgifter som enbart är avsedda för behandlaren.
Ändrat underlag kräver en ny analys. Befintliga ärenden utan de nya fälten
kan fortfarande öppnas; kompletteringarna får tomma standardvärden.

Samtyckesversionerna använder revisionssträngarna
`ai-v3-consultation-context` och `clinic-submission-v3-consultation-context`.
AI-versionen binds till leverantör, endpoint, modell och informationstext;
inskickningsversionen binds till verksamhet, informationstext, lagringstid
och behöriga behandlaradresser. Äldre samtycken omfattar inte tyst de nya
kompletteringarna. Aktuell version kontrolleras före varje AI-anrop och
varje inskickning.
Uppdatera den faktiska informationstexten och dataskydds-/kliniska granskningen
innan AI-flödet aktiveras för verkliga besökare.

## Val av analysmetod och administrationssidor

På **Admin → Anamnes → Välj analysmetod** väljer verksamheten mellan
**Poängbaserad anamnes** och **AI-assisterad anamnes**. Standard är poängbaserad.
Valet sparas i databasen och gäller nya analyser direkt, utan en ny deployment.
I poängläget gör servern inga nya leverantörsanrop, även om miljövariablerna
för AI är konfigurerade och en tidigare öppnad webbläsare skickar ett AI-val.

AI-läget gör AI tillgängligt först när serverns nyckel, modell, information,
aktiverings- och granskningsflaggor är klara. Besökaren måste dessutom
uttryckligen samtycka. Vid saknad konfiguration, uteblivet samtycke eller
leverantörsfel används poänganalysen. Admin kan spara AI som önskat läge innan
konfigurationen är klar; gränssnittet visar då att poänganalysen används.
Säkerhetsspärrarna gäller i båda lägena. En ändring stoppar nya AI-anrop men kan
inte återkalla ett redan skickat anrop. Historiska rapporter och giltiga
analyskvitton ändras inte av valet.

- `/admin/anamnes`: teknisk status och exakt vilka miljöinställningar som saknas.
- `/admin/anamnes/formler`: lägg till, ändra, inaktivera eller ta bort formler utan att ändra AI-koden. Här finns mönsterkopplingar, stöd/motregler, saknade frågor, säkerhetsuppgifter och verifieringsunderlag.
- `/admin/anamnes/arenden`: listning och skyddad terapeutvy för separat inskickade underlag. Kräver både administratörskonto och e-postadress i `ANAMNES_THERAPIST_EMAILS`.
- `/admin/inskickade-underlag`: gemensam inkorg för frivilligt inskickade självtester och anamneser. Visar namn, e-post, typ och datum. Samma extra behandlarbehörighet krävs innan uppgifter hämtas eller dekrypteras.
- `/admin/inskickade-underlag/sjalvtest/[slumpmässigt UUID]`: kontaktuppgifter, alla 40 självtestsvar, fem faspoäng, frågetexterna vid inskickningen och informationen som besökaren godkände. Behörig administratör kan radera underlaget här.
- `/admin/anamnes/arenden/[slumpmässigt UUID]`: kontaktuppgifter, fullständig anamnes, ursprunglig serverberäknad regel-/AI-assisterad rapport, samtliga mönster, säkerhetsflaggor och separata daterade behandlarbedömningar. Det slumpmässiga ID:t är inte en åtkomstnyckel; servern kontrollerar behörighet på varje läsning och ändring.

En vanlig administratör kan hantera katalogen men får inte därmed läsa hälsouppgifter. Ändra behandlarbehörighet via serverns miljövariabler och starta om/bygg om installationen enligt värdplattformens rutin. Listvyn visar inte besökarens namn eller symtom. Kontakt- och hälsoinformation placeras inte i länkar eller felmeddelanden.

Behandlarens puls-/tungobservationer, invändningar mot maskinens analys och självständiga kliniska bedömning sparas som separata versioner. Den ursprungliga rapporten skrivs inte över. Optimistisk versionskontroll avvisar samtidiga ändringar. Den här funktionen är ett konsultationsunderlag och ersätter inte en bedömning av eventuella krav på patientjournal, bevarande eller annan dokumentation.

## Sortimentskatalog och faktakontroll

Databasen initieras en gång med exakt dessa tio klassiska referenser:

1. Xiao Yao San
2. Xiang Sha Liu Jun Zi Tang
3. Bu Zhong Yi Qi Tang
4. Suan Zao Ren Tang
5. Yu Ping Feng San
6. Gui Pi Tang
7. Ba Zhen Tang
8. Du Huo Ji Sheng Tang
9. Si Miao San
10. Liu Wei Di Huang Wan

Katalogen begränsar produktreferenserna men styr inte den oberoende mönsteranalysen. Mönstermodellen kan alltså identifiera en bild där ingen av katalogens formler passar. En borttagen formel återställs inte av seedningen. En inaktiverad formel deltar inte i kommande jämförelser. Redan inskickade rapporter är historiska ögonblicksbilder och ändras inte av senare katalogredigering.

Nya formler kan läggas till och avsiktligt aktiveras i admin. De får använda de befintliga granskade mönster- och fråge-ID:na. En helt ny medicinsk mönsterdefinition behöver en separat granskad kodändring; katalogredigering ska inte skapa okontrollerad medicinsk logik.

**Alla leverantörsfakta börjar som okända.** Produktens identitet, ingredienser, säkerhet och regulatoriska status är inte verifierade genom att den klassiska formelns namn finns i katalogen. Ingen ingredienslista från China Nature har antagits eller kopierats från ett klassiskt recept. Ange endast verkligt kontrollerade uppgifter.

Innan en kopplad produkt kan markeras som tillgänglig behöver verksamheten dokumentera och markera samtliga fyra separata verifieringar:

- Produktidentitet: exakt produkt, leverantör, specifikation/version och eventuella avvikelser från klassisk formula.
- Ingredienser: den faktiska fullständiga ingredienslistan och underlag för identifiering/innehåll.
- Säkerhet: relevanta kontraindikationer, interaktioner, allergener och produktens säkerhetsuppgifter.
- Regulatorisk status: bedömning för den faktiska produkten och svensk försäljning, inklusive tillämpliga krav på märkning och marknadsföring.

Varje verifieringsmarkering kräver ett dokumenterat underlag; verifierade ingredienser kräver även en ifylld lista. Dessutom krävs en verklig kopplad publicerad produkt i den aktiverade butiken. Servern beräknar tillgängligheten på nytt; en checkbox ensam räcker inte. Interna underlagsreferenser publiceras inte. Teknisk tillgänglighet innebär inte att verksamhetens juridiska eller kliniska skyldigheter har bedömts av programmet. Resultatet ger fortfarande konsultationsuppmaning och ingen köpknapp.

Vid byte av kopplad produkt i en befintlig formel måste alla fyra verifieringsmarkeringar avmarkeras när produktbytet sparas. Granska sedan den nya produktens faktiska dokumentation och verifiera på nytt i en separat sparning. Vid ändring av ingredienslistan måste ingrediens- och säkerhetsverifiering först avmarkeras när liständringen sparas. Granska det nya innehållet, riskerna och interaktionerna innan dessa verifieras på nytt i en separat sparning. Servern avvisar ändringar som försöker behålla tidigare verifieringar över dessa byten. Tomma eller enbart blankstegsfyllda ingrediensrader räknas inte som verifierat innehåll.

## Miljövariabler

Samtliga variabler är serverinställningar. API-nycklar och lagringsnyckel får aldrig ha prefixet `NEXT_PUBLIC_`, läggas i Git eller skickas i chatten.

| Variabel | Standard / betydelse |
| --- | --- |
| `ANAMNES_PRIVACY_REVIEWED` | `0`. Sätt `1` först när verksamheten dokumenterat dataskyddsgranskningen. |
| `ANAMNES_CLINICAL_REVIEWED` | `0`. Sätt `1` först efter dokumenterad klinisk granskning av frågebank, regler, gränser och avsedd användning. |
| `ANAMNES_REGULATORY_REVIEWED` | `0`. Sätt `1` först efter dokumenterad bedömning av avsedd användning och relevant medicintekniskt/övrigt regelverk. |
| `ANAMNES_AI_ENABLED` | `0`. Separat teknisk aktivering av det valfria AI-steget. |
| `ANAMNES_AI_DAILY_LIMIT` | `100`, tillåtet 1–1000. Gemensam gräns för leverantörsförsök under en 24-timmarsperiod räknad från periodens första försök; ogiltigt värde faller tillbaka till 100. |
| `ANAMNES_AI_PROVIDER` | `openai` eller `responses-compatible`. |
| `ANAMNES_AI_MODEL` | Krävs för AI. Välj och testa en modell som stöder Responses API och strikt JSON-schema. |
| `ANAMNES_AI_API_KEY` | Serverhemlighet för vald leverantör. |
| `ANAMNES_AI_ENDPOINT` | Bara för `responses-compatible`: explicit offentlig HTTPS-endpoint med kompatibelt Responses-format. Endpoints från besökarens indata accepteras inte. |
| `ANAMNES_AI_PRIVACY_NOTICE` | Besökarinformation, minst 30 tecken. Beskriv faktisk mottagare, ändamål, retention, överföring, skydd och relevanta rättigheter. En minimilängd gör inte informationen juridiskt tillräcklig. |
| `ANAMNES_SUBMISSIONS_ENABLED` | `0`. Separat aktivering av frivillig inskickning till behandlare. |
| `ANAMNES_SUBMISSION_PRIVACY_NOTICE` | Faktisk information om ansvarig verksamhet, inskickning, åtkomst, lagringstid/radering och kontaktväg, minst 30 tecken. |
| `ANAMNES_STORAGE_KEY` | Tom som standard. Exakt 32 kryptografiskt slumpade byte som 64 hextecken; används för AES-256-GCM. |
| `ANAMNES_THERAPIST_EMAILS` | Tom som standard. Kommaseparerade e-postadresser till redan befintliga administratörer som får läsa/bedöma anamneser. |
| `ANAMNES_RETENTION_DAYS` | `30`, tillåtet 1–90 dagar. Ogiltigt värde faller tillbaka till 30. Bestämmer slutdatum för nya ärenden. |
| `CRON_SECRET` | Befintlig gemensam serverhemlighet, minst 32 tecken, för skyddad schemalagd rensning. |

Granskningsflaggor är driftspärrar och verksamhetens egna attesteringar. De utgör **inte** ett godkännande från tillsynsmyndighet, en konsekvensbedömning, ett biträdesavtal, en klinisk validering eller CE-märkning.

Generera en ny lagringsnyckel lokalt i en betrodd terminal och spara den direkt i värdplattformens skyddade miljöinställningar. Exempel med Node.js:

```sh
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Skydda terminalhistorik/utdata. Ha en separat skyddad säkerhetskopia av nyckeln enligt dokumenterad åtkomst- och återställningsrutin. Ändras nyckeln utan kontrollerad omkryptering kan befintliga ärenden inte läsas. En databasbackup utan rätt nyckel räcker inte för återställning. Ta inte bort nyckeln bara för att stoppa nya inskick; sätt `ANAMNES_SUBMISSIONS_ENABLED=0` så att behörig behandlare fortfarande kan läsa/radera befintliga ärenden.

## Aktivering i rätt ordning

1. Behåll AI och inskickning avstängda. Granska klinisk avsedd användning, frågebank, kontraindikationsspärrar, ofullständiga/motsägelsefulla svar och risken för olämpliga produktmatchningar. Dokumentera begränsningarna och validera med relevanta testfall.
2. Genomför verksamhetens juridiska och dataskyddsmässiga granskning nedan. Kontrollera om verktyget, dess marknadsföring och faktiska avsedda användning kan omfattas av reglerna för medicinteknisk mjukvara. En friskrivning ensam avgör inte klassificeringen.
3. Fyll i verklig besökarinformation. Dokumentera ansvarig verksamhet, ändamål, åtkomst, rättslig grund, känsliga uppgifter, rättigheter, incidenthantering, retention, säkerhetskopior och eventuella tredjelandsöverföringar. Knyt avtalen till de faktiska tjänster som används.
4. För AI: välj leverantör/modell, granska databehandlingen och konfigurera servernyckel/information. Koden använder strikt strukturerat svar och `store:false`. Det betyder inte automatiskt Zero Data Retention eller att annan leverantörslagring försvinner. Bekräfta aktuella avtal och retention för det egna kontot.
5. För inskickning: generera lagringsnyckel, ange riktiga behöriga adminadresser, bestäm lagringstid och konfigurera rensningsrutin. Hälsodata, kontaktuppgifter och anteckningar krypteras; datumen, slumpmässigt ärende-ID och anteckningsförfattarens interna ID är driftsmetadata i databasen.
6. Dokumentera genomförda granskningar och aktivera endast de flaggor som granskningen faktiskt medger. Kontrollera Admin → Anamnes för kvarvarande tekniska spärrar. Vercel behöver en ny deployment när miljövariabler ändras. Välj sedan **AI-assisterad anamnes** under **Välj analysmetod** i admin och spara. Miljövariablerna ensamma byter inte från standardläget poänganalys; det sparade adminvalet kan därefter ändras utan deployment.
7. Testa med syntetiska uppgifter: frivilliga val, nekad behörighet för vanlig admin/elev, formelspärrar, otillräckligt underlag, no-match, krypterad lagring, samtidig bedömning, radering, utgångna ärenden och AI-fel/fallback. Kontrollera att loggar, analysverktyg och externa skript inte fångar hälsodata.

I det vanliga analyssteget kan modellen föreslå mönster-ID:n och upp till fem obesvarade följdfrågor. Den stegvisa intervjun väljer i stället högst tre frågor per omgång. Servern validerar Zod/JSON-schema, tar bort otillåtna/obesvarbara val och förkastar hypoteser utan regelstöd. Formel- och doseringsprosa genereras inte av modellen. Granskad, datadriven text och deterministiska spärrar formar den publika rapporten. Om leverantören svarar fel, tar för lång tid eller inte är tillgänglig används regelmodellen. Läkemedels- och allergiuppgifter efterfrågas som riskflaggor; det här är inte en fullständig individuell interaktionskontroll.

Utöver begränsningen per klient finns en databaslagrad gemensam AI-budget för installationen. `ANAMNES_AI_DAILY_LIMIT` räknar leverantörsförsök under en 24-timmarsperiod räknad från periodens första försök, inklusive misslyckade försök. Budgeten används först efter kontroller av konfiguration, aktuell information/samtycke, säkerhetssvar och respektive frågeflödes krav på underlag. Förbrukad budget ger regelbaserad fallback, utan ytterligare leverantörsanrop. Gränsen avser försök, inte unika besökare; grund- och uppföljningsanalys kan använda varsitt försök. Den ersätter inte leverantörens egna kostnads- eller kreditgränser.

Vid inskickning tar servern emot validerade svar, egen beskrivning, läkemedelsnamn, normaliserade kompletteringar, kontaktuppgifter och ett separat inskickningsval. Ett godtyckligt rapportobjekt från klienten betros inte. Nya osignerade underlag med ofullständiga säkerhets-, bakgrunds- eller symtomuppgifter markeras otillräckliga vid serverns omräkning. En AI-rapport kan följa med endast tillsammans med ett giltigt serverutfärdat HMAC-SHA256-signerat analyskvitto som knyter den oförändrade rapporten till samma svar, beskrivning, kompletteringar och aktuell leverantörs-/modell-/informationskonfiguration. Kvittot gäller i 30 minuter. Ett manipulerat eller utgånget kvitto, eller ändrat underlag eller konfiguration, avvisas och kräver en ny analys; det godkänns inte tyst. Tomma nya kompletteringar bevarar den tidigare kvittostrukturen. Inskickning gör inte ett extra dolt leverantörsanrop. Utan ett tidigare AI-analyskvitto beräknas en ny regelbaserad rapport på servern. Den skyddade terapeutvyn anger vilken metod som faktiskt användes, och sparar underlaget separat från behandlarens bedömning.

I det krypterade ärendeinnehållet sparas även inskickningsinformationens exakta text och version, tidpunkt för det separata inskickningsvalet, då gällande lagringstid och, för sparade AI-rapporter, relevant AI-information/version, leverantör och modell. Analyskvittot lagras tillsammans med rapporten. Behöriga behandlare kan läsa denna historik i ärendet; kryptografiska signaturer visas inte i gränssnittet. Äldre ärenden utan denna detaljhistorik fungerar fortfarande och markeras som sådana. Historiken dokumenterar vad verktyget faktiskt tog emot, men avgör inte själv om verksamhetens rättsliga grund eller information är tillräcklig.

## Lagring, radering och säkerhetsgränser

Ärenden blir oåtkomliga efter sitt slutdatum. De och deras krypterade bedömningar tas bort vid ordinarie rensning vid inskickning, listning och öppning av ärenden. En behörig behandlare kan också radera ett helt ärende manuellt. Konfigurera schemalagd rensning även när inga besökare eller behandlare använder sidan; se endpointen nedan när den är aktiverad.

### Schemalagd rensning

`GET /api/anamnes/retention` rensar utgångna anamnesärenden, tillhörande bedömningar och inskickade självtester. Anropet kräver `Authorization: Bearer <CRON_SECRET>`, med minst 32 tecken i hemligheten. Svaret innehåller endast sammanlagt antal raderade underlag. Skicka inte hemligheten i URL:en.

Sätt upp ett dagligt jobb via en betrodd schemaläggare som kan skicka headern. Vercel Cron kan användas enligt aktuellt abonnemang och Vercels rutin för `CRON_SECRET`; något cron-schema har inte lagts till automatiskt i projektet. Kontrollera körning/fel utan att logga kontakt- eller hälsoinformation. Testa med syntetiska utgångna ärenden att både huvudpost och bedömningsposter raderas. Nyckel- och backuphantering behöver ingå i samma dokumenterade rutin.

Lagringstiden är en teknisk inställning för dessa konsultationsunderlag. Verksamheten behöver separat fastställa om andra bevarandekrav gäller. Radering ur den aktiva databasen raderar inte automatiskt äldre externa säkerhetskopior eller data som en leverantör hanterar enligt separat avtal. Dokumentera backupcykler och hur återställning hanterar raderade poster.

Rate limiting, krav på samma origin, storleksgränser, kontrollerade svarsalternativ, skyddade API-routes, servervalidering och krypterade underlag ingår. De ersätter inte en samlad säkerhetsgranskning, loggkonfiguration hos värdplattformen eller rutiner för konton och behörigheter. Undvik session replay, insamling av formulärvärden, querysträngar med hälsodata och analysverktyg som fångar sidan. Pulsuppgifter kompletteras av behandlare. Det finns ingen diagnostisk bildanalys av tungan i versionen.

## Primärkällor för verksamhetens fortsatta granskning

- [IMY: När får ni behandla känsliga personuppgifter?](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/kansliga-personuppgifter/nar-far-ni-behandla-kansliga-personuppgifter/) – hälsouppgifter kräver bedömning av både rättslig grund och tillämpligt undantag för känsliga uppgifter.
- [IMY: Konsekvensbedömning trots samtycke](https://www.imy.se/vanliga-fragor-och-svar/kan-man-behova-genomfora-en-konsekvensbedomning-trots-att-de-registrerade-har-lamnat-samtycke-till-att-deras-personuppgifter-behandlas/) – ett samtycke ersätter inte bedömningen av hög risk.
- [Läkemedelsverket: Är det en medicinteknisk produkt?](https://www.lakemedelsverket.se/sv/medicinteknik/tillverka/ar-det-en-medicinteknisk-produkt) och [Medical device software](https://www.lakemedelsverket.se/en/medical-devices/which-rules-apply-to-me/medical-device-software) – utred avsedd användning och reglerna för mjukvara innan offentlig klinisk användning.
- [OpenAI: Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) och [Your data](https://developers.openai.com/api/docs/guides/your-data) – strikt schema och `store:false` är tekniska val; konto-, avtals- och leverantörsretention måste bedömas separat.

Ingen verklig extern AI-bearbetning, produktverifiering eller produktionsaktivering genomförs enbart genom den här implementationen.
