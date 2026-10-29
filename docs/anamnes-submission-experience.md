# Tydligare sista steg för anamnesen

Resultatsidan visar **Din anamnes är klar** och en markerad ruta **Inte inskickad än – Sista steget: skicka till behandlaren** före den längre analysen. Fjärde steget i progressen heter **Granska & skicka**. Eventuella medicinska varningar behåller sin prioritet; akutflödet ersätts aldrig av en inskickningsknapp.

Knappen öppnar ett tillgängligt dialogformulär med namn, e-post och valfri telefon. Kontaktuppgifter, granskningsunderlag och lagringsinformation finns samlade där. Besökaren måste själv bekräfta inskickningen och välja **Skicka min anamnes till behandlaren**. Enbart färdig anamnes, öppnad dialog, sparat utkast eller vald AI-analys skickar inget till behandlaren.

När huvudknappen har scrollats bort visas en mindre påminnelse längst ned på skärmen, som öppnar samma dialog. Vid fel stannar uppgifterna kvar och felet visas i dialogen. Upprepad inskickning stoppas i gränssnittet medan ett anrop pågår och efter bekräftad mottagning. Den befintliga serverkontrollen för kontaktfält, aktuellt samtycke, signerat AI-underlag, krypterad lagring och behandlarbehörighet är oförändrad.

Efter ett godkänt serversvar visar både resultatsidan och dialogen **Din anamnes är skickad**, tillsammans med referens och lagringstid. Progressen ändras till **Inskickat**. Ingen mottagningsbekräftelse visas vid nätverksfel eller avvisat anrop. Ett aktivt lokalt utkast rensas som tidigare först efter bekräftad inskickning.

Information om automatisk lokal sparning ligger under startknappen och under pågående frågor. På resultatsidan finns den under **Om ditt sparade utkast** längre ned, för att skilja lokal sparning från inskickning. Vid avstängd inskickning visas kopieringsalternativet. Inga nya miljövariabler eller databasmigreringar krävs.

`tests/anamnes-submission-ui.test.ts` verifierar tydlig oskickad/skickad status, ett från början stängt dialogformulär, obligatoriska kontaktfält och aktivt samtycke, felhantering, skydd mot upprepad inskickning samt varningarnas placering. De befintliga inskicknings- och behörighetstesterna prövar servern separat.
