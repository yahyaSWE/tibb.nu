# Plan: separat differentialmodell för TCM-anamnes

Status: utvecklingsplan och experimentell testmodell, 2026-10-29. Ingen klinisk validering eller garanti om korrekt diagnos. Besökarnas befintliga anamnes behåller sitt flöde.

## 1. Kunskapsunderlag och avgränsning

Kartlägg mönsterfamiljer enligt WHO:s terminologi: åtta principer; Qi, Blod, Yin, Yang, Jing och vätskor; Zang-Fu; sammansatta mönster; yttre patogener, meridianer, sex stadier, fyra nivåer och tre Jiao. Skilj sjukdom/sökorsak (Bing) från mönster (Zheng). En namngiven klassifikation är ingen komplett differentialdiagnostik för varje patient och WHO:s klassificering är inget godkännande av effekt eller säkerhet.

Varje implementerad profil får källa, egna sammanfattade särskiljande fynd, motfynd, frågor, relaterade hypoteser, vad som kräver undersökning och granskningsstatus. Visa täckningsluckor. Importera inte skyddade fulltextdefinitioner och kalla inte en teknisk profil expertgodkänd.

## 2. Ett fristående testläge

Lägg testmodellen under Admin → Anamnes → Modelltest. Endast inloggad admin, fiktiva fall och ett aktivt val före leverantörsanrop. Samma serverkonfigurerade AI-leverantör kan användas; testmodellen är en ny fråge-/bedömningsmotor, inte en egen tränad språkmodell. Ingen automatisk aktivering för besökare, ingen ändring av produktionsmodellens inställning och ingen lagring i patientärenden.

## 3. Hypotesstyrt samtal

Utgå från hela berättelsen, tidigare svar och ändringar. Kartlägg huvudbesvärens tidsförlopp, lokalisation, karaktär, variation, utlösande/lindrande faktorer och påverkan. Behåll en bred differential och prioritera 2–4 relevanta konkurrerande hypoteser samt samtidiga mönster. Välj frågor som kan ändra bedömningen, även motfynd; ett enstaka symtom får aldrig räcka för ett mönster.

Modellen kan formulera relevanta nya frågor inom ett strukturerat svarskontrakt. Frågor har ett stabilt ämnes-ID och ett uttalat syfte, så omformulerade dubbletter kan filtreras bort. Svar är ja/nej/vet inte/avstår med valfri egen komplettering. Fråga inte om pulsdiagnostik som besökaren inte kan bedöma.

Särskilj direkta svar, citerade uppgifter ur berättelsen, preliminära tolkningar och saknade fynd. Ingen intern tankekedja exponeras; testvyn visar en kort evidensöversikt med stöd, motfynd och frågor som kan skilja hypoteserna åt.

## 4. Innehållsstyrt avslut

Ingen klinisk slutsats framtvingas efter ett visst antal frågor. Avsluta när relevanta skillnader är genomgångna, när personen väljer att avsluta eller när frågorna inte kan ge mer användbar information. Tekniska gränser för meddelandestorlek, kostnad och timeout ska ge ett återupptagbart tekniskt stopp, inte en diagnos. Ett undersökningsbehov eller motsägelse får ge ett öppet resultat. Det ska framgå vilka delar av de fyra undersökningsmetoderna som inte kan genomföras i formuläret.

## 5. Formler efter mönsteranalysen

Använd endast aktiva poster ur admin-katalogen. Mönsterbedömningen görs utan produktlistan. Jämför sedan stöd, obligatoriska komponenter, motfynd, saknade uppgifter och kontraindikationer. Högst tre referenser, tydlig delvis/utesluten/ingen matchning. Jing-brist får inte automatiskt ärva en Yin-bristformel. Ingen dosering, ordination eller köpknapp. Katalogens befintliga identitets-, innehålls-, säkerhets- och regulatoriska verifieringar gäller fortsatt; läkemedel kan kräva terapeutens interaktionskontroll.

## 6. Test och granskning

Regressionstesta bl.a. håravfall med flera alternativa mönster och utan bristfynd, magbesvär, smärta, sömn, blandbilder, negationer, tidigare behandling, okända svar, omformulerade dubbletter, symtom utanför biblioteket, akutvarningar, felaktiga AI-svar och försök att styra modellen med patienttext. Testa katalogändringar, inaktiva formler och otillräckliga produktuppgifter.

Du granskar fiktiva fall och markerar förväntade frågor, rimliga differentialer, vad som saknas och vilka formelreferenser som kan diskuteras. Teknisk testframgång mäter funktion; klinisk överensstämmelse kräver separat expertbedömning och oberoende validering. Ett framtida byte av besökarmodell blir ett separat beslut efter jämförelse.

## Primära källor

- WHO (2022), International standard terminologies on traditional Chinese medicine: https://www.who.int/publications/i/item/9789240042322
- WHO (2007), International standard terminologies on traditional medicine in the Western Pacific Region: https://iris.who.int/handle/10665/206952
- WHO, Traditional medicine in ICD-11, omfattning och begränsningar: https://www.who.int/standards/classifications/frequently-asked-questions/traditional-medicine
- Hong Kong Department of Health, fyra undersökningsmetoder och mönsterdifferentiering: https://www.cmro.gov.hk/html/eng/useful_information/public_health/pamphlet/Diagnostic_Methods_and_Features_of_CMP.html
- 1177, håravfall och differentialer som behöver fångas: https://www.1177.se/haravfall
- Leung m.fl. (2023), sjukdomsspecifik validering av TCM-frågeformulär; dess resultat kan inte överföras till allmän anamnes: https://pubmed.ncbi.nlm.nih.gov/37296429/
