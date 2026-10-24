# Frivilliga lokala utkast

Besökaren kan välja ”Spara mitt utkast på den här enheten”. Valet är från början avstängt. Ett sparat utkast ger vid återkomst en knapp för att fortsätta på den tidigare frågan. Svaret på frågan och tidigare svar återställs; kommande frågor prövas på nytt mot aktuella regler.

## Vad sparas?

- Berättelse, kompletteringar, läkemedelsnamn och bekräftade formulärsvar.
- Steg, fråge-ID, position och tidigare publika fråge-ID:n.
- Vilket frågeflöde besökaren använde, utan något samtycke.

Separata kontaktfält, leverantörs-/inskickningssamtycken, signaturer, AI-förslag, AI-rapporter och formelkatalog sparas inte. Zod-schemat är strikt och validerar även frågealternativ och förbjudna professionella frågor. Data från lokal lagring ger ingen rätt att anropa AI eller skicka ett ärende.

På resultatsidan återställs svaren och en uttryckligen ny regelrapport beräknas med aktuell katalog. Den tidigare AI-rapporten återskapas inte från ett utkast. Om katalogen saknas används inga gamla produktreferenser. Original som redan skickats till behandlaren hanteras separat av befintlig krypterad serverlagring.

## Lagring och återupptagning

Utkastet krypteras med AES-GCM och en icke-exporterbar CryptoKey och lagras i IndexedDB. Nyckeln finns i samma webbläsarprofil för att återkomst utan lösenord ska fungera. Det är inte ett skydd mot någon som använder samma profil eller kan köra kod med webbplatsens ursprung. Detta framgår av informationen vid det frivilliga valet. Ingen okrypterad reservlagring används.

Ett utkast kan återupptas under 24 timmar efter senaste lyckade sparningen. Utgångstid ingår i autentiserad krypteringsdata. Utgångna eller skadade poster läses inte. De rensas nästa gång sidan öppnas, eller vid tidsgränsen medan sidan är öppen; en stängd webbläsare kan inte köra en rensning i bakgrunden. Besökaren kan radera via formuläret, ”Rensa svar och börja om” eller webbläsarens webbplatsdata. Bekräftad inskickning till behandlaren rensar det aktuella lokala utkastet när sparandet är aktivt.

Sparning sker efter kort fördröjning och försöker även slutföras när sidan döljs. Status visas under sparningen. En webbläsare som avbryts innan en sparning hunnit slutföras kan förlora den sista ändringen. Formuläret fungerar vidare i minnet om privat läge, lagringskvot, saknad kryptografi eller annat lagringsfel hindrar utkast. Inga leverantörsnycklar, svar eller detaljerade fel loggas.

Sparning och radering serialiseras så att ett långsamt kryptografianrop inte kan återskapa ett raderat utkast. Revisionskontroll i samma IndexedDB-transaktion förhindrar att två flikar tyst skriver över varandra. Rensning av en gammal post får inte radera en nyare post från en annan flik.

## AI-valet

”Starta simpel frågeställning” visas endast när AI inte är tillgänglig. Den fristående delningsparagrafen är borttagen. Full information om leverantör och data finns under ”Mer om AI och dina svar”, med ett kort uttryckligt AI-val före start. Efter återkomst krävs ett nytt aktivt AI-val för ett återupptaget AI-flöde. Även ett sådant val tillåter inga externa anrop innan befintliga säkerhetsfrågor och serverkontroller är uppfyllda.

## Kontroller

`tests/anamnes-draft.test.ts` prövar krypterad återläsning, exakt frågeposition, privatdata som inte får sparas, felaktiga alternativ/puls, utgångstid, förvanskning, radering under långsam kryptering, konkurrerande flikar och lagringsfel. UI-tester prövar knappsynlighet, tomma samtyckesval, återupptagning utan att hälsosvar exponeras i bannern och fallback utan AI. Inga verkliga hälsouppgifter eller externa AI-anrop behövs i testerna.
