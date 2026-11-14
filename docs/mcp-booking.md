# Boka behandlingar med en AI-agent

Tibb.nu har en fjärransluten MCP-server på **`/api/mcp`**. Den använder Streamable HTTP och den officiella TypeScript-SDK:n (`@modelcontextprotocol/server` 2.x). Samma verktyg fungerar med MCP 2026-07-28 och äldre klienter som använder 2025 års initieringsflöde. Servern behöver ingen separat process eller lokal installation hos kunden och fungerar i Next.js/Vercels Node-miljö.

AI-agenten kan hitta behandlingar och tider, reservera ett besök och lämna en betalningslänk. **Kunden slutför betalningen i Stripe Checkout.** Att agenten har fått en betalningslänk betyder inte att besöket är betalt. Den befintliga signerade Stripe-webhooken på `/api/stripe/webhook` bekräftar betalningen, kontrollerar belopp/valuta och skickar bokningsmejl via den befintliga utkorgen.

## Anslut en klient

1. Publicera koden och konfigurera `APP_URL` till webbplatsens HTTPS-adress.
2. Kontrollera den befintliga Stripe-konfigurationen: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, webhooken `/api/stripe/webhook` och aktiverad kortbetalning i **Admin → Inställningar**. Publicera behandlingar och lediga tider som vanligt.
3. Lägg till en fjärransluten MCP-server i en AI-klient som stöder egna servrar och välj Streamable HTTP. Ange exempelvis `https://www.tibb.nu/api/mcp`, anpassat till din driftsadress.
4. Välj anslutning utan OAuth/inloggning för denna gästbokning. Ingen adminnyckel eller Stripe-nyckel ska lämnas till klienten. Agenten behöver tillåtas använda bokningsverktyget i klienten.
5. Be agenten lista behandlingar och hitta en tid. Kontrollera boknings- och betalningsflödet med Stripe i testläge innan det används med riktiga betalningar.

Klienter som kräver OAuth för alla egna MCP-servrar kan inte ansluta till denna gästversion. Att publicera endpointen ansluter inte automatiskt alla AI-tjänster; kunden eller klientleverantören måste lägga till anslutningen. `/llms.txt` beskriver endpointen för de agenter som läser webbplatsens offentliga innehållskarta.

### Serverinställningar

| Variabel | Betydelse |
| --- | --- |
| `APP_URL` | Betrodd adress för villkor, integritet, bokningsbekräftelse och Stripe-returer. HTTPS krävs i produktion. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Samma serverhemligheter som för webbplatsens behandlingsbokningar. |
| `MCP_BOOKING_ENABLED` | Endpointen är aktiverad som standard. Sätt `0` för att stänga av samtliga MCP-anrop och ta bort upptäcktsinformationen från `/llms.txt`. Webbplatsens vanliga bokning påverkas inte. |
| `MCP_ALLOWED_ORIGINS` | Valfri kommaseparerad lista av exakta extra webbläsarursprung, exempelvis `https://agent.example.com`. Inga jokertecken, sökvägar eller avslutande snedstreck. `APP_URL`:s ursprung tillåts alltid. |

Serverbaserade klienter och CLI-klienter utan `Origin` behöver inget extra CORS-ursprung. För webbläsarklienter med `Origin` måste klientens faktiska ursprung vara tillåtet. Att lägga till ett CORS-ursprung är inte användarautentisering; bokningsåtkomsten styrs av privata token.

## Verktyg och godkännande

| Verktyg | Indata och resultat |
| --- | --- |
| `list_treatments` | Inga argument. Returnerar aktiva behandlingar, priser i ören/SEK, längd, besöksform, behandlare, bokningsvillkor och om kortbetalning är tillgänglig. |
| `get_available_slots` | `treatmentId`, valfri `practitionerId`, `from`, `to` och `limit` (1–100, standard 30). Returnerar lediga tider, ett komplett erbjudande och `offerVersion` per tid samt en privat `bookingToken` för en vald bokning. Tider anges som ISO 8601 med tidszon; svensk visning använder `Europe/Stockholm`. `hasMore` anger att fler tider finns. |
| `create_booking_checkout` | `bookingToken`, `slotId`, `offerVersion`, `name`, `email`, valfri `phone`, och de tre godkännandena nedan. Reserverar i 35 minuter och returnerar `checkoutUrl`, privat `confirmationUrl`, status och reservationens sluttid. |
| `get_booking_status` | Endast `bookingToken`. Returnerar bokningens sammanfattning och betalningsstatus, utan namn, e-post, telefon, anamnes eller möteslänk. Vänta minst 10 sekunder mellan kontroller. |

Före bokning ska agenten visa behandling, behandlare, besöksform, tid, pris och de returnerade villkoren. Verktyget kräver `userConfirmed: true`, `termsAccepted: true` och `contactConsent: true`. Dessa intygar kundens uttryckliga godkännande; en klient får inte sätta dem automatiskt utan kundens beslut. MCP-servern kan inte observera kundens samtal med agenten och verifiera beslutet oberoende av klienten.

`offerVersion` binder erbjudandet till bland annat behandling, behandlare, tid, längd, pris, besöksform och återbudsregel. Om något ändras före reservation avvisas anropet. Hämta då ett nytt erbjudande och kundens godkännande igen. Bokningens villkor sparas också av den befintliga bokningslogiken.

Exempel på argument för reservation, efter kundens godkännande:

```json
{
  "bookingToken": "<bookingToken från get_available_slots>",
  "slotId": 123,
  "offerVersion": "<offerVersion för den godkända tiden>",
  "name": "Kundens namn",
  "email": "kund@example.com",
  "phone": "",
  "userConfirmed": true,
  "termsAccepted": true,
  "contactConsent": true
}
```

Returnera betalningslänken till kunden. Bekräfta betald bokning först när `status` är `confirmed` och `paymentStatus` är `paid`. Om Stripe-checkouten är avslutad men webhooken ännu inte har behandlats kan `checkoutUrl` vara `null` medan bokningen fortfarande är `pending`; fortsätt då med statuskontrollen. En avbokad eller utgången reservation ska inte presenteras som bekräftad, även om en betalning inväntar återbetalning.

## Privata token och återförsök

`bookingToken` är en slumpmässig 256-bitars hemlighet från servern. Den ger åtkomst till **en** MCP-bokning och används även som idempotensnyckel. Den lagras bara som SHA-256-hash i databasen. Token skickas i verktygsargumenten, aldrig som URL-parameter. Även `confirmationUrl` är en privat åtkomstlänk, precis som i webbplatsens ordinarie gästbokning. Behandla båda som hemligheter, även i klientloggar och delade konversationer.

- Återanvänd exakt samma token och normaliserade bokningsuppgifter efter timeout eller förlorat svar. Upprepade och samtidiga anrop återanvänder samma reservation. Ändrade uppgifter med samma token avvisas.
- Stripe använder samma befintliga idempotensnyckel per bokning. Ett nytt MCP-anrop ska inte skapa en ny betalningssession för en redan bifogad checkout.
- Vid ett osäkert nätverksfel behålls reservationen: Stripe kan redan ha skapat betalningen. Försök igen med samma token. Annars frigörs tiden när reservationen löper ut. Skapa inte en ny reservation för att kringgå ett osäkert svar.
- En utgången eller avbokad bokning återskapas aldrig med sin gamla token. Hämta nya tider och ett nytt kundgodkännande för en ny bokning.
- Statusåtkomsten upphör sju dagar efter det bokade besökets slut. Token kan inte användas för att söka efter andra kunder via namn, e-post eller vanliga bokningsreferenser. En borttagen boknings token tas också bort.

Detta är en avgränsad gästintegration med privata åtkomsttoken. Den ger ingen adminåtkomst, allmän kundhistorik, automatisk kortdebitering, avbokningsfunktion eller åtkomst till hälsouppgifter. Ett framtida kundkonto med flera bokningar eller hantering av bokningar kräver en separat behörighetsmodell, exempelvis OAuth.

## Drift och verifiering

Schema **14** lägger till `mcp_booking_requests` i samma transaktion som övriga databasuppgraderingar. Befintliga bokningar och webbplatsens bokningsformulär använder samma reservationsfunktion och dubbelbokningsskydd. State sparas i SQLite/Turso; MCP kräver ingen serverinstans som hålls vid liv mellan anrop. Inga nya hemligheter behövs utöver den befintliga boknings-/Stripe-konfigurationen.

Alla svar har `no-store` och `noindex`. Ej tillåtna webbläsarursprung avvisas med 403. POST-kroppar begränsas till 16 KiB. Betrodda IP-adresser får högst 300 HTTP-anrop per 15 minuter; bokningsförsök och status har ytterligare begränsningar per token/kund/IP. Vercels betrodda IP-header används automatiskt. På egen server ska `TRUST_PROXY=1` bara användas bakom en proxy som ersätter inkommande adressheader. Utan betrodd IP finns fortfarande token- och e-postgränser, men ingen IP-begränsning; konfigurera då även skydd vid webbservern.

Verktygsfel returneras som MCP-resultat med `isError: true`; HTTP 200 betyder därför inte automatiskt att en bokning lyckats. Anropen stödjer strukturerade resultat och textresultat. Äldre klienter använder `initialize`, `notifications/initialized`, `tools/list` och `tools/call` över POST. För denna stateless-server returnerar GET och DELETE 405; det är förväntat, eftersom servern inte erbjuder en separat SSE-lyssningssession. POST kan returnera JSON eller ett SSE-svar enligt MCP-klientens protokollversion.

Kör:

```sh
npm run typecheck
npm test
npm run build
```

`tests/mcp-booking.test.ts` testar verklig SQLite, protokollets två generationer, katalogfiltrering, godkännanden, ändrade erbjudanden, samtidiga bokningar, återförsök, checkoutfel, tokenåtkomst, reservationers utgång, anropsgränser, CORS och kroppsstorlek. Betalningsgatewayen är simulerad; verifiering av betald bokning använder den befintliga betalningsfunktionen. `tests/mcp-booking-migration.test.ts` testar uppgradering från schema 13 och bevarad historik/token vid omstart. Testerna skickar inga riktiga betalningar eller mejl.

Referenser: [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [MCP-transporter](https://modelcontextprotocol.io/specification/latest/basic/transports), [Stripe Checkout och betalningsbekräftelse](https://docs.stripe.com/checkout/fulfillment).
