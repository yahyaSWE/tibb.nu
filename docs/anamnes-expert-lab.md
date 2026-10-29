# Differentialmodell: separat testläge

Öppna **Admin → Anamnes → Modelltest**, `/admin/anamnes/modelltest`. Kräver admininloggning. Testet ändrar inte det publika formuläret, analysinställningen, AI-kvitton eller patientärenden. Endast fiktiva fall. Ingen testdata skrivs till ärendetabellerna; svar och granskningsanteckning finns i sidans minne tills du exporterar dem eller lämnar sidan.

## Genomför ett test

1. Välj exempel, eller skriv ett helt påhittat fall. Exempel innehåller uttryckliga standarduppgifter för en fiktiv vuxen; de är inte antaganden om en verklig patient.
2. Granska trygghetsuppgifterna och bekräfta fiktiva uppgifter. Välj AI om konfigurationen är klar och du vill skicka testdatan till den visade leverantören. Utan AI används den nya lokala frågeplaneraren, tydligt märkt som lokal.
3. Besvara följdfrågorna och komplettera med egna ord. Nästa bedömning använder hela berättelsen, kompletteringen och alla svar/anteckningar. Ändringar kan göras i svarshistoriken; en ny bedömning ersätter då den gamla vyn.
4. Granska stöd, motfynd, saknade kärnfynd, vad som behöver undersökas och referenser ur den aktiva katalogen. Jämför med dagens regelmodell på samma strukturerade svar.
5. Skriv din granskning: relevanta frågor, felriktningar, alternativa mönster, förväntade formelreferenser samt kontrollerat kapitel/sida i boken. Ladda ned JSON eller kopiera testet. Exporten är inte automatiskt expertgodkänd.

## Maciocia: tredje upplagan

Vald referens är *The Practice of Chinese Medicine*, tredje upplagan (2021/2022), ISBN 9780702079207. Förlagets presentation och innehållsförteckning är kontrollerade. Den anger 48 kliniska områden, inte alla kända mönster. Fulltexten har inte importerats eller lästs här. Inga sidnummer eller kapitelkriterier har hittats på. Ingen profil kan därför betecknas som verifierad mot bokens tredje upplaga ännu.

För en bokbaserad version behöver de relevanta diagnoskriterierna granskas mot ett lagligt tillgängligt exemplar. Dokumentera upplaga, kapitel, sida, särskiljande tecken, motfynd och formelrelation i egna sammanfattningar. Publicera inte bokens tabeller eller längre textutdrag. Utbildningsmaterial från författarens webbplats är en annan källa och märks därefter. Ingen WHO- eller författaranknytning, certifiering eller validering antyds.

## Kartläggningens räckvidd

WHO:s terminologi från 2022 lästes i sin ursprungliga PDF. Avsnitt 2.4 omfattar WGM2 988–1433: 446 numrerade poster inklusive rubriker och gruppbegrepp, inte 446 fristående kliniska diagnoser. Områdena omfattar åtta principer, orsaksrelaterade mönster, Qi/Blod/Yin/Yang/Jing/vätskor, Zang-Fu, meridianer och extraordinära kärl, tre Jiao, sex stadier och Wei/Qi/Ying/Xue. En terminologisk lista anger inte validerade diagnostiska kriterier för en automatiserad tjänst. Vi har inte kopierat denna ordlista till produktens bibliotek.

Testbibliotekets faktiska profiler och täckningsluckor visas i testvyn. Det återanvänder dagens tekniska profiler och tillför bl.a. separat Njure-Jing-, Njure-Qi-/Yang-, Lever-Yin-, Hjärt-Qi-/Yin-, Lung-Qi-/Yin- och särskilda mag-/hårbottenprofiler. Alla nya trösklar och frågeprioriteringar är tekniska granskningsutkast. Det är inte full täckning av alla TCM-diagnoser eller alla sjukdomar i Maciocias bok. Särskilt sex stadier, fyra nivåer, tre Jiao och extraordinära kärl återstår till stor del. Akuta tillstånd ska inte lösas genom att fler mönster implementeras.

## Beslutslogik

Berättelsens sökord och AI får öppna hypoteser innan poängstöd finns. De ger inte i sig bekräftade fynd. Särskiljande ämnen prioriteras efter huvudbesvär, saknade mönsterkomponenter, möjliga motfynd och skillnader mellan alternativa profiler. Modellen får omformulera neutrala frågor inom ett större ämnesbibliotek med fasta, servervaliderade svarsalternativ. Den gamla 78-frågorsbankens IDs och redan kvalificerade mönster begränsar inte AI-nomineringarna.

Servern räknar endast uttryckliga svar. `Vet inte` och `Vill inte svara` ger varken positiva eller negativa fynd och upprepas inte. Logiskt likvärdiga sömnsvar återanvänds. Varken frågeantal, AI:s egna tillräcklighetssignal eller boknamnet kan skapa en diagnos. Frågeflödet kan sluta i ett öppet undersökningsbehov. Puls, palpation och behandlarens egna observationer kan inte ersättas av självrapporter.

Fritextanteckningar påverkar AI:s nästa frågeval men räknas inte automatiskt som valda svar. Om text och ett valt alternativ motsäger varandra behöver terapeuten reda ut det; en fritextmening kan inte tyst skriva över ett bekräftat svar. Nya blandbilder måste ha stöd för varje komponent. Profilernas heuristiska poäng är inte sannolikheter, sensitivitet eller specificitet.

## Formelkatalogen

Produktlistan skickas inte till mönster-AI:n. Efter differentialen jämför servern endast aktiva katalogposter med de profiler som visas och är underbyggda i den nya motorn. Obligatoriska mönsterkomponenter, stödfynd, motfynd, saknade säkerhetsuppgifter och explicita kontraindikationer kontrolleras separat. En ny Jing-profil är inte en synonym för en befintlig Yin-profil och får inga automatiska formelkopplingar. För sådana nya profiler kan resultatet därför vara att ingen katalogformel kan kopplas.

Högst tre diskussionsreferenser. Saknade uppgifter eller andra samtidiga profiler ger delvis överensstämmelse. Underbyggda kontraindikationer kan utesluta en referens. Verifieringsstatus hämtas från de befintliga produktkontrollerna; ingen köpknapp, dos eller ordination genereras i den nya referensvyn. Läkemedel kan medföra terapeutens interaktionskontroll. Leverantörens säkerhetsuppgifter visas som kataloguppgifter och är inte en fullständig interaktionsdatabas.

## Drift

Samma serverstyrda `ANAMNES_AI_*`-konfiguration används, med befintliga granskningsflaggor och gemensam budget. Det publika poäng-/AI-valet påverkas inte. Valfri `ANAMNES_LAB_AI_MODEL` byter modell enbart för admin-testet; inga modellnamn, nycklar eller endpoints tas från en användarrequest. En ändrad servermodell ändrar testets samtyckesversion.

OpenRouter anropas via den konfigurerade Responses-endpointen med `store:false`, strikt schema och medium reasoning i testläget. Interna resonemangsblock används inte som synligt svar. Endast ett avslutat assistentmeddelande med ett giltigt svarskontrakt accepteras. Transport-, schema- och budgetfel ger ett tydligt tekniskt fel med bibehållna testfält. Det är inte ett kliniskt avslut och systemet byter inte tyst till regelmodell.

### Felsökning av AI-testet

Admin får en fast `LAB_*`-felkod som skiljer åt HTTP-avslag, anslutningsfel, timeout, ofullständiga svar, avböjande svar och ogiltigt JSON/svarskontrakt. Vid HTTP-avslag visas statusen i koden, exempelvis `LAB_UPSTREAM_HTTP_402` för betalning/kreditgräns och `LAB_UPSTREAM_HTTP_429` för leverantörens anropsgräns. Kontrollera även API-nyckelns egen gräns; ett påfyllt kontosaldo visar inte i sig vilken gräns nyckeln har. Modell-/formatavslag och behörighetsfel har egna instruktioner. Ett tekniskt fel innebär ingen färdig bedömning och fälten behålls för ett nytt försök.

Serverloggen använder endast händelsen `anamnes_lab_ai_unavailable`, en fast felkategori, eventuell HTTP-status och vid schemafel högst tre fördefinierade kontraktsfält/feltyper. Samma fältkontroll kan visas i admin. Den innehåller inga formulärsvar, råa leverantörsfel, modellutdata eller nycklar. Ingen automatisk omkörning görs som kan dra ytterligare krediter. Ett fullständigt JSON-objekt inuti ett kodblock accepteras som formatvariation; extra text, okända ID:n, extra nycklar och avbrutna svar avvisas fortfarande.

Ingen extern AI används i automatiska tester. Backendtester använder en isolerad SQLite-databas och en mockad leverantör; lokal webbläsarverifiering ska använda samma isolerade testmiljö.

## Teknisk verifiering 2026-10-29

Regressionstester och produktionsbygge passerade. Riktade tester omfattar öppna hårfall, vardagliga beskrivningar av tunnare hår, Jing/Yin-separation, okända svar, utebliven upprepning, frågor efter fler än 25 svar, behov av undersökning, säkerhet i kompletteringar, katalogaktivering och kontraindikationer. Leverantörstester kontrollerar aktuellt AI-val, separat modellinställning, felaktiga utdata, avbrutna svar och gemensam budget.

Autentiserad webbläsarverifiering passerade på dator och mobil med fiktiva fall. Gäst och student nekades API-åtkomst; ändrad adminroll kontrollerades vid nästa anrop. Egna förtydliganden och svar behölls efter simulerat transportfel. Exporten innehöll granskningsanteckning och ogranskad bokstatus. Antalet lagrade patientärenden ändrades inte. Ingen verifiering mot en verklig OpenRouter-modell eller klinisk patientbedömning har gjorts i denna körning.

## Primära källor

- [Elsevier: tredje upplagan och dess innehåll](https://evolve.elsevier.com/cs/product/9780702079207?role=student).
- [Maciocia: originalartikel On Blood Deficiency](https://giovanni-maciocia.com/wp-content/uploads/2019/02/EJOM_Blood_Deficiency.pdf): Blodmönster kan omfatta flera olika funktionella områden; ett hårsymtom räcker inte. Artikeln är inte bokens tredje upplaga.
- [WHO:s terminologi 2022](https://www.who.int/publications/i/item/9789240042322), avsnitt 2.3–2.4: terminologisk referens, inte validering av testets trösklar.
- [WHO om ICD-11:s traditionella medicin](https://www.who.int/standards/classifications/frequently-asked-questions/traditional-medicine): klassifikation innebär inget godkännande av vetenskaplig giltighet eller behandlingseffekt.
- [Hong Kong Department of Health: fyra undersökningsmetoder](https://www.cmro.gov.hk/html/eng/useful_information/public_health/pamphlet/Diagnostic_Methods_and_Features_of_CMP.html).
- [1177: håravfall](https://www.1177.se/haravfall): medicinska förklaringar och uppgifter som behöver bedömas utanför TCM-modellen.
- [Leung m.fl. 2023](https://pubmed.ncbi.nlm.nih.gov/37296429/): en validering för en avgränsad sjukdom och patientgrupp kan inte ge denna generella testmodell motsvarande giltighet.
- [OpenRouter Responses API](https://openrouter.ai/docs/api_reference/responses/overview) och [reasoning](https://openrouter.ai/docs/api_reference/responses/reasoning).
