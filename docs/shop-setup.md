# Förbered och öppna Tibb.nu:s butik

Butiken börjar **avstängd**, med frakt och hämtning förvalda. Databasuppgraderingen skapar inga produkter och ändrar inte dina tidigare bokningar, elever eller kurser. Det går att bygga upp allt i admin innan någon produkt blir offentlig.

## Produkter och utkast

Under **Admin → Produkter → Ny produkt** lägger du in namn, beskrivning, pris inklusive moms, momssats, tillgängligt lagersaldo och en valfri bild. Produkter börjar som utkast. Kontrollera att uppgifterna och momssatsen är rätt för den produkt du säljer.

**Kort produktbeskrivning** visas vid priset och köpknappen. Under **Fördjupad produktbeskrivning** kan du dessutom skriva ett längre innehåll med den visuella editorn. Använd rubriker, fetstil, kursiv text, understrykning, listor, citat och länkar. Infoga bilder direkt i texten och ange alternativtext som beskriver bilden; en valfri bildtext visas under den. JPG, PNG och WebP stöds, högst 2 MB per bild och 20 bilder per beskrivning. Bilderna lagras i samma databas som produktens huvudbild.

Spara produkten och klicka **Förhandsgranska produkt** för att se både beskrivningar och alla bilder. Förhandsvisningen fungerar för utkast och medan butiken är stängd. Den längre beskrivningen är valfri och kan tömmas utan att ändra den korta texten. Uppladdade bilder blir offentliga först när de ingår i en sparad, publicerad produkt i en öppen butik.

Två villkor behöver vara uppfyllda för offentlig visning och nya köp: **produkten är publicerad** och **butiken är öppen**. Publicering av en produkt öppnar inte butiken. Opublicerade produkter och bilder kan bara förhandsgranskas av admin. När butiken är stängd försvinner dess menylänkar och produkterna tas bort från webbplatsens sitemap och AI-innehållskarta.

**Admin → Butik → Förhandsgranska** visar även utkast, utan köpknappar. Utkasten och bilderna skyddas på servern. En tidigare besökare kan förstås ha sparat en bild eller produktbeskrivning medan den var offentlig.

Bildformat: JPG, PNG eller WebP, högst 2 MB. Servern kontrollerar bildinnehållet, skalar till högst 1280 × 1280 och sparar WebP utan källans metadata. Produktbilderna lagras i databasen och behöver ingen ny Blob-anslutning. Säkerhetskopiera databasen; oanvända bildversioner ligger kvar och behöver tas med när databasens storlek planeras.

## Frakt och hämtning

Under **Admin → Butik** väljer du vilka leveranssätt som erbjuds:

- Frakt inom Sverige med en egen fraktkostnad. `0` innebär fri frakt. Du kan ange en valfri ordergräns för fri frakt.
- Hämtning utan fraktkostnad. Ange den riktiga hämtningsadressen och hur kunden får besked om hämtning.

Fraktkostnaden börjar på `0`; kontrollera den innan du öppnar. Kunden ser båda alternativen, när de är aktiverade, och totalbeloppet ändras vid valet. Fraktetiketter och transportörsavtal ordnas separat; admin kan registrera spårningsnumret.

Fyll också i butikens faktiska köp- och returvillkor. Kunden läser villkoren i kassan och beställningen behåller den text som gällde vid köpet. Lägg in verksamhetens fungerande kontaktadress under **Admin → Inställningar** och komplettera integritetsinformationen för orderuppgifter med verksamhetens faktiska lagringstider och rättsliga grund.

## Anslut betalningen

Butiken använder Stripe Checkout och svenska kronor. Bokningarnas Stripe-webhook fortsätter att vara separat. Lägg in servervariablerna i Vercel Production; hemligheter ska aldrig läggas i adminformulär, chatten, Git eller `NEXT_PUBLIC_`-variabler.

| Variabel | Användning |
| --- | --- |
| `APP_URL` | Exakt betrodd HTTPS-origin. Använd `https://tibbnu.vercel.app` tills din egen domän fungerar. |
| `STRIPE_SECRET_KEY` | Verksamhetens hemliga Stripe-nyckel; samma Stripe-konto kan användas för bokningar. |
| `SHOP_STRIPE_WEBHOOK_SECRET` | Hemligheten för butikens **separata** endpoint `/api/shop/webhook`. |

Skapa butikens endpoint hos Stripe för `https://din-fungerande-doman/api/shop/webhook` med händelserna `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` och `charge.refunded`. Behåll bokningarnas endpoint `/api/stripe/webhook` och dess `STRIPE_WEBHOOK_SECRET`. Publicera på nytt efter ändrade servervariabler.

Admin visar om konfigurationsvärden finns; det verifierar inte att Stripe-kontot, nycklarna eller webhookinställningarna fungerar. Kör först ett kontrollerat köp i Stripes testmiljö och kontrollera betalning, båda leveransvalen, avbruten betalning och återbetalning. Preview använder separata testvärden och en separat databas. Se också den befintliga [driftguiden](operations.md) för projektets driftsplan.

## Lager och beställningar

Kassan beräknar pris, frakt och tillgänglighet från databasen och reserverar varorna i cirka 30 minuter. Samtidiga köp kan inte reservera samma sista vara. En övergiven eller avbruten obetald reservation återförs en gång. Ett gammalt adminformulär får inte skriva tillbaka ett tidigare lagersaldo: ladda om produkten om du får meddelandet att lagret ändrats.

Betalning bekräftas endast av en signerad Stripe-händelse med rätt belopp och valuta. Att besöka beställningslänken markerar aldrig något som betalt. Om betalning trots allt kommer efter att lagret släppts begärs återbetalning; sidan visar att den väntar tills Stripe bekräftat den.

**Admin → Beställningar** visar orderstatus, betalning, kund, varor och leverans. En betald fraktorder kan markeras skickad med spårningsnummer; en hämtningsorder kan markeras klar eller hämtad. Verksamheten meddelar kunden när varan är redo. Vanliga återbetalningar hanteras i Stripe. En återbetalning av en redan betald order återför inte automatiskt fysiska varor till lagret; kontrollera returen och uppdatera lagret själv.

Orderbekräftelser via Resend är förberedda. Anslut enligt [e-postguiden](email-setup.md). Utskicksstatus visas i admin och väntande jobb kan behandlas där eller med den befintliga outbox-endpointen. En privat beställningslänk ger åtkomst till orderuppgifter och ska inte delas.

## Öppna eller stäng butiken

När innehåll och anslutningar är klara: välj **Öppna butiken på hemsidan** under **Admin → Butik** och spara. Servern kräver betalningskonfiguration, kontaktadress, köpvillkor, minst ett leveranssätt och hämtningsadress om hämtning erbjuds. Dessa kontroller kan inte ersätta det kontrollerade testköpet.

Avmarkera samma inställning och spara för att stänga. Det stoppar nya köp och döljer butiken, medan du fortsätter arbeta i admin. Redan påbörjade Stripe-betalningar och befintliga beställningar kan fortfarande behandlas. Hantera därför tidigare beställningar även när butiken är stängd.

Denna version har enskilda produkter, gästköp och lager per produkt. Den innehåller ingen variantmotor, automatisk fraktetikett eller koppling från produktköp till kursåtkomst.

Butiken har också produktpaket med gemensamt komponentlager, mängdrabatter, rabattkoder och automatisk frakt enligt dina regler. Se [guiden för paket, rabatter och frakt](shop-offers-shipping.md) för inställningar och prisberäkning.
