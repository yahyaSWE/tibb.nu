# Granskning före publicering av det uppdaterade örtsortimentet

Datum: 2026-10-20. Internt arbetsunderlag för Tibb.nu. Detta dokument är en granskningslista, inte en genomförd klinisk validering, produktklassificering, juridisk bedömning eller ett myndighetsgodkännande. Godkända programtester visar tekniskt beteende; de visar inte att en mönsterhypotes eller örtprodukt är korrekt för en person.

Källtranskriberingen och dess kvarstående innehållsfrågor finns i [anamnes-leverantorsunderlag.md](./anamnes-leverantorsunderlag.md). Original-PDF och interna leverantörsuppgifter ska inte publiceras som bilagor.

AI-kontraktets aktuella version är `ai-v7-medication-references` efter uppdateringen 2026-10-21 av läkemedelskontexten. Tidigare medicinering i fritext spärrar inte analysen; uttryckligen pågående medicinering markeras för interaktionskontroll utan att stoppa det preliminära mönsterunderlaget eller relevanta formelreferenser. Referenserna är underlag för terapeutens obligatoriska kontroll av läkemedel, interaktioner och kontraindikationer före användning; de är inte bedömda som säkra tillsammans med personens läkemedel. En pågående analys från en äldre version kan inte skickas in med sitt gamla kvitto; besökaren får göra om analysen efter omladdning. Tidigare lagrade anamnesrapporter och terapeutanteckningar behåller sina originaluppgifter och räknas inte om mot den nya katalogen. Separata dokumentreferenser och deras granskningsbehov beskrivs i [anamnes-frageflode-specialbestallning.md](./anamnes-frageflode-specialbestallning.md).

## Tjänstens avsedda ändamål måste bedömas

Den aktuella funktionen tar emot en persons hälsouppgifter, väljer följdfrågor, föreslår preliminära TCM-mönster och jämför dem med namngivna produkter inför rådgivning. Bedömningen inför publicering måste omfatta denna faktiska användning, inklusive terapeutvyn och marknadsföringen. Att kalla resultatet preliminärt eller utbildande avgör inte i sig om regelverk blir tillämpliga.

Läkemedelsverket beskriver att programvarans avsedda medicinska ändamål styr kvalificeringen och att även NMI-regler kan behöva beaktas. Låt ansvarig sakkunnig dokumentera vilka regler som gäller för just tjänsten och vilka åtgärder som då krävs innan användning. [Läkemedelsverket: Medical device software](https://www.lakemedelsverket.se/en/medical-devices/which-rules-apply-to-me/medical-device-software).

- [ ] Dokumentera avsedd användare, målgrupp, användningsmiljö, vilken information som lämnas och vilka beslut funktionen ska stödja.
- [ ] Granska tjänstens faktiska funktion och alla påståenden mot det dokumenterade ändamålet. Ta med startsida, resultat, terapeutvy och reklam.
- [ ] Dokumentera kvalificering och eventuell klassificering samt behov av klinisk utvärdering, riskhantering, kvalitetssystem och övriga tillämpliga åtgärder. Utgå inte från ett antaget undantag för AI eller TCM.
- [ ] Beskriv begränsningar, felhantering, ansvarig behandlarbedömning och vad som händer vid osäkra svar. Inga texter får påstå att systemet är kliniskt validerat, godkänt eller kan ställa säker diagnos när sådant underlag saknas.

## Klassificera varje faktisk produkt och granska påståendena

TCM-namn och leverantörens kategorisering fastställer inte om en produkt får säljas som kosttillskott i Sverige. Bedöm både innehåll, beredning och presentation. Kontrollwiki beskriver gränsen mellan kosttillskott och läkemedel, inklusive att vissa växter eller substanser kan påverka klassificeringen. [Livsmedelsverkets Kontrollwiki: Närliggande produkter till kosttillskott](https://kontrollwiki.livsmedelsverket.se/artikel/82/nar-b-li-b-ggande-produk-b-te-b-r-till-kosttillskott).

Medicinska försäljningspåståenden förutsätter rätt läkemedelsstatus; ett eventuellt hälsopåstående för livsmedel är en annan kategori. En leverantörs traditionella sjukdomslista är inte ett tillåtet produktpåstående genom att den översätts eller återges av AI. [Läkemedelsverket: Naturprodukt, laglig eller inte?](https://fragor.lakemedelsverket.se/org/lakemedelsverket/d/naturprodukt-laglig-eller-inte/).

- [ ] Dokumentera bedömningen för var och en av de tio faktiska produkterna, inklusive relevant försäljnings-/importroll, märkning och spårbarhet.
- [ ] Granska produkttexter, anamnesresultat, artiklar, bilder, SEO-data och eventuell AI-text för otillåtna behandlings- eller sjukdomspåståenden.
- [ ] Håll leverantörens sjukdomslistor och övrig intern källdokumentation i skyddad administration. Kontrollera även API-svar, HTML, klientkod och strukturerade data; en stängd informationsflik gör inte innehåll privat.
- [ ] Kontrollera att namngivna formelreferenser saknar automatisk köporder, individuell dosering eller personlig ordination. Personlig rådgivning ersätter inte en separat produkt- och regelgranskning.

## Underlag som måste verifieras för varje produkt

För varje post behöver ansvarig granskare identifieras och daterat underlag sparas. Ett klassiskt formelnamn eller en leverantörs allmänna PDF är inte en kontroll av den levererade slutprodukten.

- [ ] Slutlig produktidentitet, tillverkare, artikel/batch, etikett och koppling till rätt butikspost.
- [ ] Samtliga råvaror: botanisk identitet, växtdel, beredning och faktisk ingredienslista. Bevara originaluppgifterna separat från senare bekräftelser.
- [ ] Mängd, styrka, proportioner och extraktionsförhållande där relevant. Fyll inte luckor med standardrecept eller antagna koncentrationer.
- [ ] Produkt- och batchspecifik kvalitet, relevanta analyser av föroreningar, hjälpämnen, allergener och dokumentation från tillverkaren.
- [ ] Fullständig säkerhetsbedömning för ingredienserna och blandningen, inklusive interaktioner med läkemedel och andra tillskott, kontraindikationer och särskilda riskgrupper.
- [ ] Skriftlig lösning från leverantören för Stomachs Bai Dou Kou/Sha Ren, Six Herbs Shu/Sheng Di Huang och SLBZ:s saknade Bai Bian Dou. En sparad textrad är dokumentation, inte i sig ett bevis på att uppgiften stämmer.
- [ ] Kontrollera kopplat lager och publiceringsstatus separat. Lagerantal, aktiv referens och fyra verifieringsmarkeringar är olika saker; ingen av dem utgör ett myndighetsgodkännande.

Livsmedelsverket beskriver risker med kosttillskott och samtidig användning av läkemedel. Bedömningen behöver därför vara produktspecifik och får inte reduceras till frånvaro av en varning i leverantörsdokumentet. [Livsmedelsverket: Risker med kosttillskott](https://www.livsmedelsverket.se/livsmedel-och-innehall/kosttillskott/risker-med-kosttillskott/).

## Skilj leverantörsvarningar från kompletterande kontrollfrågor

Leverantörens uttryckliga försiktighetsuppgifter bevaras med sidnummer i `supplierProfile.cautions`. Anamnesens kompletterande TCM-regler och följande säkerhetsgranskning är separata lager. De ska inte märkas som om de uttryckligen stod i PDF-filen. Saknad leverantörsvarning betyder inte att en risk är utesluten.

För produkter där ingredienslistan anger Gan Cao, Gan Cao Zhi eller motsvarande lakritsråvara behövs exempelvis en separat kontroll av råvara, faktisk beredning, innehåll och interaktioner. NCCIH beskriver risker med glycyrrhizin, bland annat allvarlig hjärtpåverkan, särskild sårbarhet vid högt blodtryck samt hjärt-/njursjukdom och rapporterade interaktioner med kortikosteroider. Detta är kompletterande säkerhetskunskap, inte verifierade koncentrationer eller en riskkvantifiering för dessa tio slutprodukter. [NCCIH: Licorice Root](https://www.nccih.nih.gov/health/licorice-root).

- [ ] Anta inte att en viss beredningsbeteckning betyder att glycyrrhizin saknas. Dokumentera faktisk produktinformation innan slutsatser dras.
- [ ] Kontrollera läkemedelsuppgifter och övriga riskfaktorer individuellt. Den automatiska spärren är inte en komplett interaktionskontroll.
- [ ] Bevara att kontraindikationer och saknade obligatoriska säkerhetssvar utesluter en referens oavsett poäng. Ett osäkert infektionssvar får inte räknas som bekräftad frånvaro av infektion.

## Dokumentera beslutet före publicering

| Område | Ansvarig granskare | Underlag och datum | Beslut/kvarstående åtgärd |
| --- | --- | --- | --- |
| Tjänstens avsedda ändamål och tillämpliga programvaruregler | Ej angivet | Ej dokumenterat här | Kräver bedömning |
| Produktklassificering, import och märkning per produkt | Ej angivet | Ej dokumenterat här | Kräver bedömning |
| Faktiskt innehåll, tre källkonflikter och kvalitet | Ej angivet | Leverantörstranskription finns; slutproduktskontroller saknas | Inte färdigverifierat |
| Säkerhet, kontraindikationer och interaktioner | Ej angivet | Leverantörsuppgifter och kompletterande kontrollpunkter finns | Fullständig granskning återstår |
| Publika produktpåståenden och informationsgränser | Ej angivet | Tekniska gränser ska funktionstestas | Sakkunnig granskning återstår |
| Hälsodata, leverantörsavtal, åtkomst och lagring | Ej angivet | Befintliga skydd ska återkontrolleras vid ändrad användning | Dokumenterat ansvar behövs |

Håll produktstatus overifierad tills rätt underlag och ansvarig bedömning finns. Den här checklistan innebär inte ett beslut att publicera eller börja sälja produkterna.
