# Praktiskt test av anamnesen

Syftet är att bedöma hur väl formuläret förbereder en konsultation och vilka uppgifter behandlaren fortfarande behöver fråga om. Ett fungerande tekniskt flöde eller ett rimligt formelförslag visar inte i sig klinisk träffsäkerhet.

Använd påhittade uppgifter vid de första testerna. Den lokala QA-förhandsvisningen kan använda simulerade AI-svar; det prövar gränssnittet och överlämningen. Bedöm riktiga modellens frågeurval separat i en korrekt konfigurerad installation.

## Fem första testfall

1. **Blandade besvär:** en fiktiv vuxen beskriver stelhet i nacke och axlar, käkspänning och huvudvärk. Ange flera områden, intensitet, frekvens, vardagspåverkan, mål och vad som tidigare har hjälpt. Kontrollera att detaljerna finns kvar vid granskning och hos behandlaren.
2. **Tidigare medicinering:** skriv ”Jag har tidigare provat medicin utan effekt” i berättelsen och i fältet för tidigare behandling. Svara Nej på frågan om läkemedel **just nu**. AI och mönsteranalysen ska fortsätta, utan en läkemedelsflagga från fritexten. Läkemedelsord eller preparatnamn tolkas inte automatiskt som pågående användning; det uttryckliga formulärsvaret styr.
3. **Pågående läkemedel och separat allergifall:** svara först Ja enbart på aktuell läkemedelsanvändning och ange ett fiktivt namn i läkemedelsfältet. Frågor och en underbyggd preliminär mönsterhypotes ska fortsätta även med AI, om övriga uppgifter och samtycket tillåter det. Relevanta formelreferenser visas också vid pågående medicinering. En tydlig notering hos både besökare och behandlare ska kräva terapeutens kontroll av läkemedel, interaktioner och kontraindikationer före användning; ingen köp- eller doseringsrekommendation ska skapas. Läkemedelsnamn och särskilda detaljfält skickas inte till AI, medan Ja/Nej-svaret ingår. Lägg därefter till en fiktiv allergisk reaktion som ett separat test: den ska fortfarande medföra individuell säkerhetsbedömning och lokala frågor. Inget av fallen ska ge en automatisk örtordination.
4. **Osäkert eller otillräckligt underlag:** välj några ”Vet inte”, gå tillbaka och ändra ett svar, lägg till ett förtydligande och avsluta tidigt. Rapporten ska behålla osäkerheten och inte fylla luckor med en formelmatchning.
5. **Överlämning:** granska underlaget, skicka det uttryckligen till behandlaren och kontrollera bekräftelsen. Öppna ärendet med behörigt behandlarkonto. Kontrollera att egen berättelse, kompletteringar, säkerhetsuppgifter och maskinens förslag är tydligt åtskilda. En bokning ska inte framställas som att underlaget skickats automatiskt.

Kontrollera också separat att uppgivna akuta varningssymtom fortfarande avbryter flödet. Testa sådana uppgifter endast som ett påhittat fall.

## Anteckna efter varje fall

- Förstod besökaren frågorna och kunde hen beskriva det viktigaste?
- Vilka relevanta frågor saknades eller upprepades i onödan?
- Fanns motstridiga svar och obesvarade frågor tydligt redovisade?
- Kunde behandlaren snabbt hitta huvudbesvär, förlopp, läkemedel och säkerhetsuppgifter?
- Vilka preliminära TCM-hypoteser var rimliga respektive missvisande, och varför?
- Visades en formel trots att underlaget borde ha varit otillräckligt eller en säkerhetsfråga behövde klarläggas?
- Vilka egna undersökningar och kompletterande frågor behövdes vid mötet?

Låt gärna behandlaren först bedöma besökarens egna uppgifter innan de maskinella hypoteserna visas. Jämför sedan för att upptäcka om rapporten styr bedömningen för tidigt. Ändra inte poänggränser bara för att fler fall ska få ett formelförslag.
