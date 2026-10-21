# Frågeflöde och referenser för specialbeställning

Uppdaterat 2026-10-21. Tekniskt arbetsunderlag, inte klinisk validering.

## Besökarens inledning och kompletteringar

Plats, intensitet, frekvens, vardagspåverkan, mål, tidigare undersökning/behandling och vanor visas som vanliga fält tillsammans med den egna berättelsen. De är frivilliga; ett tomt fält är ingen negation. Varje AI-anrop innehåller den aktuella berättelsen och hela det tillåtna kompletteringsunderlaget, inklusive uppdaterade kommentarer till frågor. Även utan en inledande berättelse kan dessa fält styra val av frågor. De blir aldrig automatiskt poängsatta fynd eller formulärsvar.

Läkemedels-/sjukdoms-/allergidetaljer och kommentarer till säkerhetsfrågor ingår inte i AI-projektionen. Strukturerade säkerhetssvar och fritext kontrolleras före extern överföring. Läkemedelsord i fritext skapar inte en säkerhetsflagga: pågående användning samlas in genom frågan om läkemedel **just nu**. Ett uttryckligt Ja får statusen `medication_review`: det tillåter fortsatt mönsteranalys, AI efter samtycke och relevanta preliminära formelreferenser. Varje sådan referens anger att en terapeut måste granska läkemedel, interaktioner och kontraindikationer före användning. Visningen innebär ingen automatisk interaktionskontroll eller bekräftad produktlämplighet, och anamnesen ger ingen produktlänk för direktköp i det fallet. Uttryckliga formelspecifika kontraindikations- och säkerhetsregler gäller fortfarande. Övriga spärrar förblir oförändrade. Patientuppgifterna i användarens skärmbilder har inte skickats till en extern modell under utvecklingen.

Skillnaden mellan mönsterunderlag och produktlämplighet är avsiktlig. [NCCIH:s information om ört–läkemedelsinteraktioner](https://www.nccih.nih.gov/health/tips/tips-how-herbs-can-interact-with-medicines) stöder behovet av en separat kontroll före användning av örter; en tekniskt genomförd mönsteranalys verifierar inte säkerheten hos en produktkombination.

## Färre upprepningar utan en fast frågegräns

Ett nej på frågan om muskel-/ledvärk motsäger inte buksmärta. Bukbesvär har fått alternativet ”Krampartat eller i omgångar”. En allmän fråga kan täcka en snävare fråga bara när det valda strukturerade alternativet logiskt besvarar den, exempelvis insomningssvårigheter eller nattliga svettningar. Evidenslistan visar det verkliga valda ursprungssvaret. Uttryckliga osäkra eller avböjda svar skrivs inte över.

Fördjupningen samlar centrala uppgifter och särskiljande fynd för relevanta hypoteser. Den går inte igenom varje stödregel i katalogen eller fortsätter fråga om muskelvärk efter ett tydligt nej vid ett annat huvudbesvär. Frivilliga stödpoäng för en formel kräver inte extra frågor; obligatoriska produkt-/säkerhetsvillkor och väsentliga motfynd behålls. Administratörens säkerhetsregler har företräde framför generell relevansfiltrering. Smärtinriktad anamnes behåller kontrollen av varm/svullen led.

Det finns ingen ny fast gräns för antalet frågor eller AI-omgångar. Två syntetiska lokala magprofiler gav 31 respektive 29 svar inklusive åtta säkerhetsfrågor. Detta är exempel, ingen garanti för alla besökare eller externa modellval. Det automatiska regressionstestet kräver att den första profilen avslutas med relevant täckning och utan upprepning. Osäkra svar kan fortfarande lämna underlaget ofullständigt.

## Dokumentbiblioteket

Källa: `notificatie boek (2).pdf`, 146 PDF-sidor, SHA-256 `a5e0e5360a5c29347be1c2255ecadc9a6b7d6bd11810b8f4f7179edff18a124e`.

127 identifierade produktposter finns transkriberade med ursprungliga ingrediensstycken, engelska beskrivningar och sidreferenser i det skyddade administrationsunderlaget. Poster kan sökas i **Admin → Anamnes → Formelkatalog → Dokumentbibliotek för specialbeställning**. Ett val förbereder en inaktiv referens. Administratören måste koppla relevanta mönster och regler innan den kan sparas och aktiveras. Nya mönster utanför dagens mönstermodell kräver separat utveckling och granskning.

För nedanstående elva poster har källsidorna också granskats visuellt och en uttrycklig regelkoppling förberetts. Det innebär inte att produktinnehåll eller klinisk lämplighet är verifierade. Övriga poster är endast indexerade och transkriberade; de är inte aktiverade och har inte fått automatiskt gissade regelkopplingar.

| Dokumentnamn / klassisk referens | PDF-sidor | Oberoende mönster i modellen |
| --- | --- | --- |
| Air / Qing Zao Jiu Fei Tang | 5–6 | Torrhet |
| Bu Zhong Yi Qi Pian | 20 | Qi-sjunkning |
| Destagnation / Xue Fu Zhu Yu Pian | 37–38 | Blodstas |
| Diges / Bao He Wan | 40 | Födostagnation |
| Du Huo Ji Sheng Tang | 41 | Långvarig Bi med bristfynd |
| Gui Pi Tang | 61 | Hjärt-/Mjälte-bristprofil |
| Si Jun Zi Tang | 110 | Mjälte-Qi-brist |
| Si Wu Tang | 113 | Lever-Blodbrist |
| Suan Zao Ren Tang | 114 | Lever-Blodbrist och Shen-störning |
| Xiao Yao San | 130–131 | Lever-Qi-stagnation, Mjälte-Qi-brist och Blodbrist |
| Yu Ping Feng San | 136 | Lung-/Wei-Qi-brist |

Det ordinarie sortimentets tio China Nature-poster behålls. Biblioteket använder nya källspecifika `special-book-*`-ID:n. Tidigare borttagna poster återställs inte. Olika produktversioner med liknande klassiskt namn sammanblandas inte. Dokumentoriginalet är oföränderligt efter sparande; egna regler, verifieringsbesked och aktivering redigeras separat. Engångsmigreringen respekterar senare inaktivering och borttagning.

## Publikt resultat

Först görs en oberoende mönsteranalys, därefter katalogjämförelsen. Högst tre befintliga regelkontrollerade referenser visas. Vid två jämnt stödda alternativ kan de synas även i den översta resultatrutan, med tydlig osäkerhet och delvis överensstämmelse. Ett otillräckligt eller säkerhetsblockerat resultat fylls inte med en påtvingad ”närmaste” produkt. En tom AI-differential får inte ersättas av en tvingad regelhypotes.

Specialbeställningar märks som dokumentreferenser och länkar till **”Fråga om specialbeställning · boka rådgivning”**. De kan inte bli köpbara genom en verifieringsflagga eller produktlänk. Källans fullständiga ingredienslistor, doseringsuppgifter och sjukdomspåståenden skickas varken till AI eller i det publika katalogsvaret. Dokumentets uppgifter och utländska notifikationsnummer är inte verifiering av en faktisk slutprodukt eller dess svenska regulatoriska status.

Behandlaren behöver pröva mönsterkopplingarna, kontrollera faktiskt innehåll, interaktioner och lämplighet samt följa den tidigare [granskningslistan](./anamnes-sortiment-granskning.md). Ingen individuell dosering, automatisk ordination eller direktköpsrekommendation genereras. Tekniska tester ersätter inte denna granskning.

## Verifiering

Tester använder ägda lokala SQLite-fixturer, syntetiska svar och en simulerad modell. Ingen extern modell behövs för dessa tester. Kontroller omfattar sammanhållen AI-kontext, inga upprepningar, faktisk evidensproveniens, osäkra säkerhetssvar, källsekretess, beständig inaktivering/borttagning, oföränderliga dokumentkällor och avsaknad av direkta specialbeställningsköp. Källindexet är serverunderlag; det ska inte ligga i publika JavaScript-resurser.
