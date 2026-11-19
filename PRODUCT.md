# Tibb.nu

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Besökare bokar behandlingar, köper produkter och kurser och söker information om verksamheten. Elever använder den befintliga elevportalen. Administratören hanterar innehåll, köp och bokningar.

## Product Purpose

En sammanhängande svensk webbplats för Tibb.nu:s behandlingar, utbildning och e-handel. Friskvårdstillägget ska låta kunder köpa specificerade personliga behandlingstillfällen och få ett tillförlitligt betalningsunderlag.

## Capabilities and Constraints

- Befintlig Next.js-app, SQLite/Turso, privat lagring och Resend återanvänds.
- Ägaren har valt Kustom Checkout för den nya butiks-/friskvårdskassan. Befintliga andra betalningsflöden får inte ändras oavsiktligt.
- Friskvårdsakupunktur avser avslappning och muskelspänningar. Kostrådgivning avser hälsosamma matvanor. Medicinsk behandling och produkter ska inte räknas som friskvårdsunderlag.
- Klippkort är personliga, specificerade i antal tillfällen och normalt giltiga i tolv månader.
- Betalningsunderlag ska skilja auktorisation från styrkt betalning. Arbetsgivaren avgör ersättningen.
- Arbetet sker på separat branch. Inga produktionsändringar eller riktiga betalningar är godkända för denna implementation.

## Brand Commitments

Svenska, tydliga gränssnitt som följer webbplatsens befintliga grafiska profil och fungerar i mobilen. Befintliga logotyper, typografi, komponenter och tillgänglighetsmönster är utgångspunkt. Företagsuppgifter och medicinska påståenden får inte hittas på.

## Open Decisions

Kustom-kontots faktiska testkonfiguration och externa stagingmiljö behöver anslutas av ägaren. Juridiska kvittouppgifter hämtas från verifierade verksamhetsinställningar.
