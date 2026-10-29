# Ordinarie adaptiv anamnes, version 2

Besökarflödet `/anamnes` använder nu samma differentiella motor som adminmodelltestet. Det omfattar 48 tekniska mönsterprofiler och 108 tillåtna besökarfrågor, inte 108 frågor som alla ska besvara. Den tidigare offentliga AI-modellen valde fasta fråge-ID:n ur den äldre banken. Den nya kan också formulera neutrala följdfrågor inom ett större, servervaliderat ämnesbibliotek och öppna nya hypoteser innan en äldre poängprofil kvalificerats.

## Hela besökarresan

- Egen berättelse och kompletteringar används vid varje anrop. Egna förtydliganden följer med sina frågor. Fritext blir inte automatiskt bekräftade fynd.
- Åtta trygghetsfrågor finns kvar. Vid relevanta smärtuppgifter efterfrågas även en möjlig röd, varm eller svullen led. Osäkra säkerhetsuppgifter ger ingen trygghetsgaranti.
- Befintliga driftflaggor, adminvalet AI/regelanalys, aktuellt besökarval, serverstyrd leverantör, anropsgränser och gemensam kostnadsbudget gäller fortsatt. `ANAMNES_AI_MODEL` styr besökarnas modell. `ANAMNES_LAB_AI_MODEL` gäller endast adminexperimentet.
- Privat läkemedelsnamn och de separata fälten för läkemedel, sjukdomar och allergier skickas inte till leverantören. Kontaktuppgifter samlas in först vid separat inskickning. Ett AI-svar är inte ett godkännande av en produkt.
- Lokalt läge och teknisk reserv använder samma nya mönstermotor. Ett tekniskt fel märks som lokal bedömning, inte som ett lyckat AI-anrop.
- Utkast stöder även de nya frågorna. De sparas krypterat i webbläsaren enligt den befintliga 24-timmarsregeln, utan AI-samtycke, kontaktuppgifter eller analyskvitto.
- Rapporter, kopierad text och inskickning innehåller den nya bedömningen och de nya svaren. Fullständiga AI-original signeras på servern och bevaras krypterat vid inskickning. Ett ändrat original eller ändrade svar godtas inte med ett gammalt kvitto. Äldre ärenden förblir läsbara med sin ursprungliga rapport.

## Frågeantal och avslut

Ingen klinisk maxgräns eller garanterad normalmängd finns. Högst tre frågor hanteras åt gången. Om AI väljer en eller två relevanta frågor fylls omgången inte på med lokala extrafrågor. En bred standardlista läggs inte längre till efter en redan kartlagd differential. Valida nya AI-frågor prioriteras framför lokala, stödjande extrafrågor, medan huvudbesväret fortfarande behöver karakteriseras.

När AI väljer granskning och inte föreslår fler obesvarade frågor kan en karakteriserad historia överlämnas. Underbyggda profiler, motfynd och kvarvarande osäkerheter bevaras. En granskningssignal skapar aldrig ett positivt fynd eller en diagnos; utan underbyggd profil anges ett undersökningsbehov. Ett tidigt manuellt avslut med ofullständig bakgrund får inte omvandlas till en starkare bedömning vid inskickning. Ingen uppskattning om exempelvis 20–40 frågor är ett uppmätt genomsnitt.

## Sortiment och bokreferens

Sortimentet skickas inte till mönsterplaneraren. Högst tre aktiva referenser jämförs efter den oberoende bedömningen, med stöd, motfynd, ofullständiga kriterier och kontraindikationer. Nya profiler är inte automatiskt synonymer för äldre katalogkopplingar; till exempel görs ingen automatisk omvandling från Jing-brist till en Yin-formel. Ett saknat relevant alternativ ger ingen framtvingad produktmatchning. Produktverifiering och individuell lämplighet är separata kontroller.

Maciocias tredje upplaga är fortfarande en önskad granskningsreferens. Fulltext och sidbundna kriterier har inte verifierats. Publiceringen gör inte profilerna bokverifierade, kliniskt validerade eller godkända av författaren eller WHO.

## Träffsäkerhet

Förbättrad upplevd frågerelevans är ännu inte uppmätt diagnostisk träffsäkerhet. Ingen trovärdig procentsats kan anges. De tekniska testerna verifierar bland annat svarskontrakt, ingen upprepning, säkerhetsgränser, konsekvent rapportering och signaturkontroll; de är inte kliniska facit.

De befintliga 50 kvalitetsfallen gäller den tidigare regeljämförelsen. För den nya motorn behöver en separat, representativ fallserie granskas självständigt av en kvalificerad bedömare, med förväntade huvud-/sekundärmönster, motfynd, korrekt osäkerhet och relevanta formelreferenser. Granskningen bör skilja underbyggd träff, missat mönster och felaktigt föreslaget mönster. Utvecklingsfall och en separat slutlig utvärderingsmängd bör hållas isär. Rapportera mönstervis överensstämmelse och feltyper, inte en påhittad generell säkerhetsprocent.
