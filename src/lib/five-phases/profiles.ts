import type { ElementType } from "./types";

export type ElementProfile = {
  label: string;
  character: string;
  theme: string;
  description: string;
  summary: string;
  strengths: string[];
  balanced: string;
  stress: string;
  support: string[];
  traditional: string[];
};

// The associations below describe the traditional model, not a person's organs
// or health. The reflective descriptions are not a clinical assessment.
export const ELEMENT_PROFILES: Record<ElementType, ElementProfile> = {
  wood: {
    label: "Trä",
    character: "木",
    theme: "Tillväxt, riktning, rörelse och flexibilitet.",
    description:
      "Trä symboliserar tillväxt och rörelse i de fem faserna. Som tema för självreflektion handlar det om riktning, initiativ och utrymme att förändras.",
    summary:
      "Träkonstitutionen präglas av rörelse, utveckling och riktning. Du trivs ofta bäst när du känner att du kan utvecklas och röra dig framåt. När din naturliga rörelse hindras kan frustration och spänning lättare uppstå.",
    strengths: [
      "Driv",
      "Vision",
      "Planering",
      "Initiativ",
      "Beslutsamhet",
      "Kreativitet",
    ],
    balanced:
      "Om du känner igen dig i Trä kan balans innebära att förena driv och tydliga mål med flexibilitet. Du kan ge plats åt både egna initiativ och ändrade planer, utan att varje steg behöver föra dig framåt direkt.",
    stress:
      "I den här traditionella beskrivningen kan stress märkas som frustration, irritation, spänning eller en känsla av att vara blockerad. Fundera på om du känner igen sådana reaktioner och i vilka situationer de uppstår; resultatet avgör inte vad du upplever eller varför.",
    support: [
      "Välj ett litet, rimligt nästa steg när många mål konkurrerar om din uppmärksamhet.",
      "Lämna utrymme i planeringen för pauser och för att något kan ändras.",
      "Reflektera över vad du kan påverka och vad som behöver få ta tid.",
      "Sätt tydliga gränser för hur mycket du försöker hinna med.",
    ],
    traditional: [
      "Lever och Gallblåsa",
      "Vår",
      "Vind",
      "Senor",
      "Ögon",
      "Ilska/frustration",
    ],
  },
  fire: {
    label: "Eld",
    character: "火",
    theme: "Värme, kontakt, glädje och uttryck.",
    description:
      "Eld symboliserar värme och uttryck i de fem faserna. Som tema för självreflektion handlar det om glädje, kontakt och hur engagemang får plats tillsammans med vila.",
    summary:
      "Eldkonstitutionen präglas av värme, kontakt och uttryck. Du får ofta energi genom inspiration, relationer och engagemang. Balans handlar om att låta elden lysa utan att tempot blir så högt att du förbrukar dina reserver.",
    strengths: [
      "Entusiasm",
      "Kommunikation",
      "Social förmåga",
      "Inspiration",
      "Värme",
      "Närvaro",
    ],
    balanced:
      "Om du känner igen dig i Eld kan balans innebära att uppskatta gemenskap och inspiration samtidigt som du ger plats åt lugn. Engagemanget får då finnas utan att du behöver vara tillgänglig eller hålla ett högt tempo hela tiden.",
    stress:
      "I den här traditionella beskrivningen kan stress märkas som rastlöshet, överstimulering, svårigheter att varva ner eller mental utmattning. Använd det som en fråga om dina egna erfarenheter, inte som en bedömning av ditt mående.",
    support: [
      "Låt lugna stunder få en egen plats mellan sociala aktiviteter.",
      "Reflektera över vilka åtaganden som känns givande och vilka som tar mer än du vill ge.",
      "Välj en enkel kvällsrutin som ger utrymme att avsluta dagens aktiviteter.",
      "Tillåt dig att tacka nej och att vara mindre tillgänglig när du behöver vila.",
    ],
    traditional: [
      "Hjärta",
      "Sommar",
      "Värme",
      "Blodkärl",
      "Tunga",
      "Glädje",
      "Shen",
    ],
  },
  earth: {
    label: "Jord",
    character: "土",
    theme: "Näring, stabilitet, centrum och omsorg.",
    description:
      "Jord symboliserar stabilitet och omsorg i de fem faserna. Som tema för självreflektion handlar det om trygghet, vardagens rutiner och balansen mellan att stötta andra och sig själv.",
    summary:
      "Jordkonstitutionen präglas av stabilitet, näring och omsorg. Du har ofta lätt för att skapa trygghet omkring dig och ta ansvar för andra. Balans innebär även att ge dig själv samma stöd som du ger din omgivning.",
    strengths: [
      "Omsorg",
      "Stabilitet",
      "Pålitlighet",
      "Praktisk förmåga",
      "Empati",
      "Förmåga att samla människor",
    ],
    balanced:
      "Om du känner igen dig i Jord kan balans innebära att omsorgen också omfattar dina egna behov. Trygghet och pålitlighet kan gå tillsammans med att dela ansvar, be om stöd och lämna utrymme för förändring.",
    stress:
      "I den här traditionella beskrivningen kan stress märkas som grubblande, mental tyngd, överansvar eller tröghet. Reflektera över om tankarna går i cirklar eller om du bär mer ansvar än du önskar; detta är inte en förklaring till kroppsliga besvär.",
    support: [
      "Skapa några enkla hållpunkter i vardagen utan att kräva en perfekt rutin.",
      "Skriv ner det som upptar tankarna och skilj ett möjligt nästa steg från sådant som kan vänta.",
      "Prata om hur ansvar kan delas och öva på att be om hjälp.",
      "Ge din egen vila och dina egna gränser samma omsorg som du ger andra.",
    ],
    traditional: [
      "Mjälte och Mage",
      "Sen sommar/centrum",
      "Fukt",
      "Muskler",
      "Mun",
      "Tänkande och grubblande",
    ],
  },
  metal: {
    label: "Metall",
    character: "金",
    theme: "Struktur, gränser, kvalitet och att kunna släppa taget.",
    description:
      "Metall symboliserar struktur och urskiljning i de fem faserna. Som tema för självreflektion handlar det om kvalitet, tydliga gränser och att kunna avsluta eller släppa taget.",
    summary:
      "Metallkonstitutionen präglas av struktur, tydlighet och urskiljning. Du uppskattar ofta kvalitet, ordning och tydliga principer. Balans innebär att behålla strukturen utan att den blir så rigid att förändring blir svår.",
    strengths: [
      "Ordning",
      "Disciplin",
      "Precision",
      "Integritet",
      "Kvalitetsmedvetande",
      "Förmåga att avsluta",
    ],
    balanced:
      "Om du känner igen dig i Metall kan balans innebära att använda struktur som stöd och samtidigt lämna utrymme för det ofullkomliga. Tydliga gränser kan gå tillsammans med vänlighet mot dig själv och flexibilitet när förutsättningarna ändras.",
    stress:
      "I den här traditionella beskrivningen kan stress märkas som perfektionism, rigiditet, självkritik eller svårighet att släppa taget. Fundera på när dina krav hjälper dig och när de blir betungande; testet fastställer ingen orsak till dessa erfarenheter.",
    support: [
      "Bestäm vad som är tillräckligt bra innan du börjar en uppgift.",
      "Lämna små marginaler i dina rutiner så att ändrade planer får plats.",
      "Reflektera över vilka krav du vill behålla och vilka du kan släppa.",
      "Låt avslut och pauser få plats utan att allt måste vara färdigt först.",
    ],
    traditional: [
      "Lunga och Tjocktarm",
      "Höst",
      "Torrhet",
      "Hud",
      "Näsa",
      "Sorg",
    ],
  },
  water: {
    label: "Vatten",
    character: "水",
    theme: "Djup, reserv, uthållighet och potential.",
    description:
      "Vatten symboliserar djup och potential i de fem faserna. Som tema för självreflektion handlar det om eftertanke, långsiktighet och utrymme för återhämtning.",
    summary:
      "Vattenkonstitutionen präglas av djup, observation och långsiktig uthållighet. Du tänker gärna under ytan och sparar dina resurser till sådant som verkligen är viktigt. Balans innebär att skydda dina reserver utan att dra dig undan från världen.",
    strengths: [
      "Djup",
      "Uthållighet",
      "Eftertanke",
      "Strategi",
      "Observation",
      "Viljestyrka",
    ],
    balanced:
      "Om du känner igen dig i Vatten kan balans innebära att förena eftertanke och uthållighet med kontakt och handling. Tid för dig själv kan få finnas tillsammans med små steg mot sådant du vill delta i.",
    stress:
      "I den här traditionella beskrivningen kan stress märkas som tillbakadragande, osäkerhet, rädsla eller en känsla av uttömning. Reflektera över skillnaden mellan vald stillhet och att dra dig undan mer än du önskar; resultatet är ingen hälsobedömning.",
    support: [
      "Lägg in tid för vila innan kalendern är helt fylld.",
      "Välj ett hållbart tempo och små steg för långsiktiga projekt.",
      "Reflektera över vilka gränser som skyddar din tid och vilka som begränsar sådant du vill göra.",
      "Ge plats både åt egen tid och kontakt med människor du känner dig trygg med.",
    ],
    traditional: [
      "Njure och Urinblåsa",
      "Vinter",
      "Kyla",
      "Ben och märg",
      "Öron",
      "Rädsla",
      "Jing och Zhi",
    ],
  },
};

export const TEST_DISCLAIMER =
  "Testet är avsett för utbildning och självreflektion och bygger på traditionella teorier inom kinesisk medicin. Det är inte ett medicinskt diagnostiskt verktyg och ersätter inte individuell bedömning av legitimerad vårdpersonal eller kvalificerad behandlare.";

const COMBINATION_DESCRIPTIONS: Partial<
  Record<`${ElementType}+${ElementType}`, string>
> = {
  "wood+fire":
    "Om du känner igen dig i både Trä och Eld kan riktning och driv möta värme och engagemang. Kombinationen kan ge utrymme för initiativ och kontakt. Reflektera över hur inspiration kan få plats tillsammans med pauser och ett rimligt tempo.",
  "wood+earth":
    "Din Träenergi ger riktning och driv medan Jord bidrar med stabilitet och omsorg. Kombinationen kan göra dig både utvecklingsorienterad och ansvarstagande. Se beskrivningen som en möjlighet till självreflektion: hur kan egna mål och omsorg om andra få plats utan att ansvaret blir för stort?",
  "wood+metal":
    "Om du känner igen dig i både Trä och Metall kan utveckling och initiativ möta struktur och precision. Kombinationen kan hjälpa dig att tänka på både riktning och genomförande. Reflektera över när tydliga ramar ger stöd och när de behöver vara mer flexibla.",
  "wood+water":
    "Om du känner igen dig i både Trä och Vatten kan rörelse och beslutsamhet möta eftertanke och långsiktighet. Kombinationen kan ge plats åt både nästa steg och det större perspektivet. Reflektera över hur handling och vila kan få utrymme i din planering.",
  "fire+earth":
    "Om du känner igen dig i både Eld och Jord kan värme och uttryck möta omsorg och trygghet. Kombinationen kan ge plats åt gemenskap och praktiskt stöd. Reflektera över hur du kan delta och hjälpa till samtidigt som du ger dina egna behov och gränser utrymme.",
  "fire+metal":
    "Om du känner igen dig i både Eld och Metall kan spontanitet och kontakt möta tydlighet och kvalitet. Kombinationen kan ge plats åt både levande uttryck och genomtänkta ramar. Reflektera över hur struktur kan stötta engagemang utan att varje möte behöver bli perfekt.",
  "fire+water":
    "Om du känner igen dig i både Eld och Vatten kan utåtriktat engagemang möta stillhet och djup. Kombinationen kan ge plats åt både gemenskap och egen tid. Reflektera över när du önskar kontakt och när du vill dra ner på intrycken, utan att behöva välja samma tempo varje dag.",
  "earth+metal":
    "Om du känner igen dig i både Jord och Metall kan omsorg och pålitlighet möta struktur och tydliga gränser. Kombinationen kan ge plats åt både stöd och ordning. Reflektera över hur ansvar kan delas och hur rutiner kan vara hjälpsamma utan att bli för krävande.",
  "earth+water":
    "Om du känner igen dig i både Jord och Vatten kan stabilitet och omsorg möta eftertanke och uthållighet. Kombinationen kan ge plats åt trygghet och långsiktiga perspektiv. Reflektera över hur du kan finnas för andra och samtidigt låta egen tid och vila ha en självklar plats.",
  "metal+water":
    "Om du känner igen dig i både Metall och Vatten kan precision och urskiljning möta djup och långsiktighet. Kombinationen kan ge plats åt noggrant övervägda val. Reflektera över när eftertanke är hjälpsam och när ett litet steg framåt kan få vara tillräckligt, även utan full visshet.",
};

export function getCombinationDescription(
  primary: ElementType,
  secondary: ElementType,
): string {
  if (primary === secondary) {
    return `Båda resultaten pekar mot ${ELEMENT_PROFILES[primary].label} i den här modellen. Använd beskrivningen som ett underlag för självreflektion; den definierar inte vem du är eller hur du mår.`;
  }
  return (
    COMBINATION_DESCRIPTIONS[`${primary}+${secondary}`] ??
    COMBINATION_DESCRIPTIONS[`${secondary}+${primary}`] ??
    "Utforska vilka delar av de två beskrivningarna du känner igen i din vardag."
  );
}
