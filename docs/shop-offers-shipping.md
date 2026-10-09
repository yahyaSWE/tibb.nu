# Paket, rabatter och automatisk frakt

Butikens öppna/stäng-inställning gäller även dessa funktioner. Inga nya produkter, rabattkoder eller transportörspriser skapas automatiskt. Förbered dina uppgifter i admin medan butiken är stängd.

## Produktpaket

Skapa en produkt under **Admin → Produkter** och välj produktpaket. Välj vilka ordinarie produkter och antal som ingår, ange paketets pris inklusive moms och spara som utkast. En produkt kan säljas både separat och i flera paket.

Produkttypen väljs vid skapandet och kan inte ändras senare. Skapa en ny produkt om du behöver byta mellan vanlig produkt och paket; tidigare lager och beställningar behåller då sin betydelse.

Paketets tillgängliga antal beräknas från lagret för dess innehåll. Det finns inget separat paketlager att hålla uppdaterat. När någon köper ett paket reserveras rätt antal av varje ingående produkt. Om samma vara också ligger separat i varukorgen räknas behoven ihop innan reservationen görs.

Publicera även de ingående produkterna innan paketet visas offentligt. Paket med opublicerat innehåll kan fortfarande förhandsgranskas av admin. Kontrollera pris, innehåll och moms för det du säljer. En beställning behåller sitt köpta innehåll även om du ändrar paketet senare.

I denna version behöver paketets produkter ha samma momssats som paketet. Paket med blandade momssatser stöds inte. Om en ingående produkts momssats ändras så att den avviker från paketets döljs paketet tills uppgifterna stämmer igen.

## Mängdrabatter

Under **Admin → Rabatter** kan du skapa flera nivåer, exempelvis en regel för ett visst minsta antal och en annan för ett högre antal. Ange ett namn, vilka produkter som omfattas, minsta antal, rabatt i procent och om regeln är aktiv.

Du väljer om kunden måste köpa flera av **samma produkt**, eller om antalet får räknas samman från **blandade produkter** som regeln omfattar. Vid flera matchande mängdrabatter används den bästa procentsatsen för varje berörd produkt; nivåerna staplas inte. Produktpaket har sitt eget paketpris och får ingen extra mängdrabatt.

## Rabattkoder

Rabattkoder skapas i samma adminvy. En kod ger procent eller ett fast belopp på varorna, med valfritt minsta ordervärde, giltighetsperiod och maximalt antal användningar. Kunden kan använda en kod per beställning. Frakt ingår inte i rabattunderlaget.

Välj om koden får kombineras med andra erbjudanden. En kombinerbar kod räknas efter paketpris och mängdrabatt. En kod som inte får kombineras ersätter mängdrabatterna och kan inte användas i en varukorg med produktpaket. Kunden får ett meddelande om kombinationen inte är tillåten.

Kodens minsta varuvärde kontrolleras efter de erbjudanden den får kombineras med, före kodens egen rabatt.

Användningsgränsen räknar även pågående betalningar, så att flera kunder inte kan boka samma sista kodanvändning. En avbruten eller utgången obetald beställning släpper sin reservation. En återbetalning av en betald beställning ger inte automatiskt en ny användning av koden.

Kassan kontrollerar koden på servern och visar rabatt och slutpris innan kunden går till Stripe. Varken priser eller rabattbelopp som skickas från webbläsaren används som betalningsunderlag.

Denna butik har inget separat flöde för gratisbeställningar. Kassan avvisar betalningsbelopp under 3 kronor efter rabatter. Det motsvarar Stripes dokumenterade minimum för SEK-avräkning; kontrollera kontots inställningar om det avräknas i annan valuta. Se [Stripes beloppsgränser](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts).

## Fraktregler

Under **Admin → Frakt** lägger du in dina egna fraktpriser. Ange vikt i gram på varje ordinarie produkt och valfri emballagevikt för en försändelse. Paketets vikt beräknas från innehållet. Vikten `0` på en produkt betyder att vikten ännu saknas; ange den riktiga vikten innan du använder viktregler.

Varje fraktregel kan innehålla:

- Namn på leveransalternativ, transportör och tjänst.
- Pris inklusive moms och prioritet.
- Minsta och högsta vikt samt ordervärde.
- Svenska postnummerprefix som regeln omfattar. Tom lista omfattar alla svenska postnummer.
- Aktiv eller avstängd status.

När automatisk frakt är aktiverad används den matchande regeln med **lägst prioritetsnummer**. Om flera matchar med samma prioritet används lägst pris, därefter regelns id. Vikt- och beloppsgränser omfattar båda ändpunkterna; ge överlappande regler tydliga prioriteter.

Ordervärdet för frakt beräknas **efter rabatter**. Inställningen för fri frakt kontrolleras mot det värdet. Hämtning är fortfarande kostnadsfri. Om en försändelse saknar vikt eller ingen aktiv regel kan hantera den får kunden ett tydligt meddelande och kan inte betala med en gissad fraktkostnad.

När automatisk frakt är avstängd används butikens vanliga fasta fraktkostnad och gräns för fri frakt. Kontrollera inställningarna innan du öppnar butiken.

Detta är din egen pristabell. Transportörernas namn hämtar inte aktuella priser från deras API:er, skapar inga fraktetiketter och beställer ingen transport. Fyll i priserna enligt ditt avtal och håll dem uppdaterade. Tariffer som även beror på mått, skrymmande gods eller andra tillägg behöver anpassade regler eller en separat frakttjänst innan sådana produkter säljs.

## Kontrollera före försäljning

Förhandsgranska utkasten, testa dina mängdnivåer och kodgränser och prova både frakt och hämtning. Kontrollera särskilt vikter och postnummer vid gränserna för varje regel. Gör sedan kontrollerade köp med Stripe-testnycklar och separat testdatabas enligt [butiksguiden](shop-setup.md).

Beställningen sparar de slutliga priserna, rabatterna, paketens innehåll och leveransvalet. Senare ändringar i admin ändrar inte gamla beställningar. Om ett erbjudande eller fraktpriset ändras medan kunden fyller i kassan behöver kunden granska det uppdaterade priset innan betalningen öppnas.
