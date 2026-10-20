# Internt leverantörsunderlag för anamnesens formelkatalog

Detta dokument beskriver den tekniska transkriberingen av den användartillhandahållna `rangejohan.pdf`, tillskriven China Nature. Samtliga 16 PDF-sidor har lästs och jämförts med renderade sidor. Uppgifterna är leverantörsbeskrivningar av traditionella TCM-funktioner. De verifierar varken medicinsk effekt, slutproduktens säkerhet, faktisk lagerstatus eller att ett produktpåstående får publiceras.

- Källa: `rangejohan.pdf`, 16 sidor.
- SHA-256: `70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0`.
- Strukturerad transkribering: `src/lib/anamnes/supplier-source.ts`.
- Sidnummer avser PDF-filens sidordning, med första sidan som sida 1.
- PDF-filen och de renderade leverantörssidorna ska inte läggas under `public/` eller göras till publika bilagor.

## Omfattning och spårbarhet

Fälten `ingredients`, `actions`, `traditionalPatterns`, `indications`, `explanation`, `temperature` och `cautions` har sidreferenser. Fältet `kind` skiljer uttrycklig leverantörstext (`supplier`), kompletterande tolkning (`interpretation`) och sådant som inte är verifierat (`unverified`). Denna källmodul innehåller ingen kompletterande klinisk tolkning: de traditionella mönsteravsnitten är hämtade ur leverantörens egna formuleringar. Kompletterande regler för anamnes och differentialer måste hållas åtskilda från dessa källuppgifter.

| Användarens produktnamn | Formel | Ingredienslista | Actions | Indikationer | Förklaring | Anmärkningar |
| --- | --- | --- | --- | --- | --- | --- |
| Athletic Herbs | Zhuang Yao Tang | 1 (6 örter) | 1 | 1 | 1–2 | 2 |
| Coptis & Scute Herbs | Huang Lian Jie Du Tang | 2 (4 örter) | 2 | 2–3 | 3 | Ingen separat lista |
| Tonic Herbs | Shi Quan Da Bu Tang | 3 (12 örter) | 3–4 | 4 | 4 | 4 |
| Stomach Herbs | Xiang Sha Liu Jun Zi Tang | 5 (9 örter) | 5 | 5–6 | 6 | Ingen separat lista |
| Four Marvel Herbs | Si Miao San | 6 (4 örter) | 6 | 6–7 | 7 | Ingen separat lista |
| Relax & Resolve Herbs | Hua Yu Xiao Yao San | 7 (12 örter) | 7–8 | 8–9 | 9 | 9 |
| Six Herbs | Liu Wei Di Huang Wan | 10 (6 örter) | 10 | 10 | 11 | 11 |
| Women's Herbs | Ba Zhen Tang | 11 (8 örter) | 11 | 12 | 12 | 12 |
| SLBZ Herbs | Shen Ling Bai Zhu San | 13 (9 örter) | 13 | 13–14 | 14 | 14 |
| Auranthii Herbs | Chai Hu Shu Gan San | 15 (7 örter) | 15 | 15 | 15–16 | 16 |

Nya tekniska id:n börjar med `supplier-`, så att historiska anamneser och tidigare produktkopplingar inte får nya produktidentiteter av misstag. Auranthii ingår i de nya tio. Astachi förekommer inte i PDF-filen och ska inte läggas till i det aktiva sortimentet. Tidigare Xiao Yao San ska inte likställas med den modifierade Hua Yu Xiao Yao San.

De tio tidigare inbyggda katalogposterna tas bort vid första kataloginläsningen efter uppdateringen. Detta gäller även installationer där de redan har inaktiverats av den tidigare sortimentsmigreringen. Historiska anamnesrapporter och terapeutanteckningar bevaras som separata krypterade ögonblicksbilder. Senare egna tillägg, redigeringar och borttagningar av leverantörsformler återställs inte av städningen.

## Tre olösta innehållsmotsägelser

Följande källmotsägelser finns i `verificationIssues`. De ska markeras för kontroll och får inte lösas genom att anta standardrecept från en annan tillverkare.

1. **Stomach Herbs, s. 5–6:** listan anger **Bai Dou Kou – amomum rotundus fructus**. Förklaringen anger **Fructus Amomi (Sha Ren)**. Listan behåller Bai Dou Kou; Sha Ren läggs inte till eller byts in utan bekräftelse.
2. **Six Herbs, s. 10–11:** listan anger **Shu Di Huang – rehmania praeparata radix**. Förklaringen anger **Sheng Di Huang**. Listan behåller Shu Di Huang. Vilken beredningsform och råvara produkten faktiskt innehåller behöver leverantören bekräfta.
3. **SLBZ Herbs, s. 13–14:** **Semen Lablab (Bai Bian Dou)** beskrivs i förklaringen men finns inte i ingredienslistan. Den läggs inte till i listan utan leverantörens bekräftelse.

## Temperatur och namn

Endast Athletic har en uttrycklig temperaturangivelse för den samlade formeln, **warm**, på s. 2, och Four Marvel **cold** på s. 7. Coptis beskrivs på s. 3 som en sammansättning av bittra, kalla örter; detta återges som leverantörstext och ska inte omtolkas till verifierade tillverknings- eller slutproduktdata. För övriga produkter anges inte en uttrycklig samlad temperaturklassificering. Enskilda örters temperatur och ord som värmer eller kyler i Actions är inte samma uppgift.

PDF-filen innehåller inga kinesiska skrivtecken för formlerna. `chineseName` är därför `null`; pinyin återges i `formulaName` utan påhittade Hanzi. Originalens stavning och beredningsbeteckningar bevaras, även exempelvis `rehmania`, `glycyrrhizha`, `Gan Cao Zhi`, `Huang Bai (sheng)`, `Ban Xia (Jiang)` och `Zhi Qiao (Chao)`. Detta är en transkribering, inte botanisk identitetsverifiering.

Användarens godkända produktnamn **Athletic Herbs** skiljer sig från PDF-rubriken **Athelic herbs**. Båda lagras, i `productName` respektive `pdfProductName`. På s. 1 står även `xuan niu xi - cyathula radix`, medan förklaringen på s. 2 skriver `Chuan Niu Xi`. Källans namn bör stämmas av mot den slutliga etiketten och råvaruspecifikationen. Ingen ingrediens byts automatiskt ut för att rätta stavningen.

## Leverantörens mönster och begränsningar

Detta är en orientering till dokumentets uppgifter, inte en rekommendation till en viss person.

- **Athletic, s. 1–2:** värmande Yang-inriktning, Vind-Kyla-Fukt, kroniska ländryggsbesvär och senor/ben. PDF avråder vid graviditet och anger försiktighet vid Yin-brist eller Fukt-Hetta.
- **Coptis & Scute, s. 2–3:** överskott med Hetta, Eld och toxiner i tre Jiao. Det är inte ett generellt stöd för att varje värmesymtom motsvarar formeln. PDF innehåller ingen fullständig produkt- eller interaktionssäkerhet.
- **Tonic, s. 3–4:** Qi- och Blodbrist med Kyla; Ba Zhen-variation med värmande Yang-inriktning. Blek tunga, tunn vit beläggning och trådfin svag puls nämns. Undvik enligt PDF under förkylning/influensa; försiktighet vid svag matsmältning.
- **Stomach, s. 5–6:** Fukt-Kyla i mellersta Jiao, reglering av Qi och nedåtriktad Mag-Qi samt distension och stagnation. Innehållsmotsägelsen ovan är olöst.
- **Four Marvel, s. 6–7:** Fukt-Hetta i nedre Jiao, bland annat gula/feta tungbeläggningar och sparsam gul urin i den traditionella beskrivningen. Någon separat kontraindikationslista ges inte.
- **Relax & Resolve, s. 7–9:** Lever-Qi-stagnation, Hetta och Blodstas, samtidigt med Blodbrist. PDF skiljer uttryckligen mellan överskotts- och bristkomponenterna. Undvik enligt PDF vid Vind-Kyla/Vind-Hetta; försiktighet under graviditet.
- **Six, s. 10–11:** Lever-/Njure-Yin med beskrivning av bristhetta. Försiktighet vid Fukt anges. Shu/Sheng-motsägelsen är olöst.
- **Women's, s. 11–12:** Qi- och Blodbrist. Hetta/överskott beskrivs som fel eller otillräcklig inriktning. Akuta infektioner anges som kontraindikation.
- **SLBZ, s. 13–14:** Mjälte-Qi-brist med Fukt, lös avföring, nedsatt aptit och svaghet. Leverantören anger att formeln saknar hettaklarerande örter och inte passar vid Hettatillstånd eller förstoppning. De bakomliggande effektförklaringarna i PDF är leverantörspåståenden, inte verifierad farmakologi. Innehållsmotsägelsen ovan är olöst.
- **Auranthii, s. 15–16:** främst Qi-reglering vid Lever-Qi-stagnation/överskott, distension, flankspänning och emotionell anspänning. PDF beskriver kortvarig användning och att samtidiga andra mönster behöver annan bedömning. Dokumentets behandlingsexempel får inte återanvändas som individuell dosering eller behandlingstid.

PDF:s sjukdomslistor bevaras endast som intern källdokumentation i `indications`. De är inga tillåtna effektpåståenden och ska inte publiceras som att produkterna behandlar exempelvis diabetes, cancerrelaterade tillstånd, multipel skleros, infertilitet eller hjärtsjukdom. Listorna ska inte styra automatisk produktmatchning.

## Saknade uppgifter före tillgänglig produkt

Varje post markerar följande som ej verifierat: mängd av varje ingrediens, styrka, extraktionsförhållande, färdigproduktspecifikation, batchidentitet och kvalitet, analys av föroreningar, fullständig säkerhet/interaktioner samt regulatorisk status. Uppgifterna saknas eller är ofullständiga i PDF-filen. Inga värden fylls i genom antaganden.

Även följande behöver hämtas in där det är relevant: exakta botaniska identiteter, använda växtdelar och beredningar, hjälpämnen/allergener, tillverkarens kvalitetshandlingar och produktens slutliga märkning. En allmän ingredienslista eller TCM-beskrivning verifierar inte dessa uppgifter. Saknad varning i PDF betyder inte frånvaro av risk.

Särskilt Coptis & Scute behöver granskning av de faktiskt ingående råvarorna och möjliga interaktioner innan produktstatus kan godkännas. Anamnesens regelspärrar ersätter inte sådan granskning. Graviditet, läkemedel, lever-/njuruppgifter och allergi ska fortsätta kräva självständig bedömning enligt det befintliga säkerhetsflödet.

## Granskning före publicering

Källorna kan användas för preliminära, utbildande TCM-referenser inför individuell rådgivning. De räcker inte för att aktivera försäljning, ange personlig dosering eller automatiskt ordinera örter. Produktpåståenden, klassificering som läkemedel eller kosttillskott, import/märkning och eventuell medicinteknisk funktion måste bedömas för den faktiska tjänsten och produkten före publicering. Denna dokumentation är inte en sådan regulatorisk granskning eller ett godkännande.
