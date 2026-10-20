import { rule } from './patterns';
import { supplierFormulaSources } from './supplier-source';
import { FormulaRecordSchema, type FormulaRecord } from './types';

// These former built-in catalog entries are removed by the assortment cleanup.
// Historical report snapshots and later administrator additions are preserved.
export const legacyFormulaIds = [
  'xiao-yao-san','xiang-sha-liu-jun-zi-tang','bu-zhong-yi-qi-tang','suan-zao-ren-tang','yu-ping-feng-san',
  'gui-pi-tang','ba-zhen-tang','du-huo-ji-sheng-tang','si-miao-san','liu-wei-di-huang-wan',
] as const;

const common = {
  active:true,pinyin:'',hanzi:'',swedishName:'',secondaryPatternIds:[],requiredPatternIds:[],requiredQuestionIds:[],
  supportingRules:[],opposingRules:[],contraindicationRules:[],requiredSafetyRules:[],theoryExplanation:'',
  scopeLimitation:'Preliminär TCM-referens inför personlig rådgivning. Reglerna är kompletterande, ej kliniskt validerade tolkningsregler. Hela mönsterbilden och produktens säkerhet behöver bedömas självständigt.',
  ingredients:[],tongueIndicators:[],pulseIndicators:[],classicalSource:'',identityEvidence:'',ingredientEvidence:'',safetyEvidence:'',regulatoryEvidence:'',
  productId:null,productUrl:null,productIdentityVerified:false,ingredientsVerified:false,safetyVerified:false,regulatoryVerified:false,
  supplierProfile:null,requiresVerification:false,verificationResolution:'',
  safetyNotes:['Leverantörens formelbeskrivning är källdokumentation, inte verifiering av den faktiska slutproduktens innehåll, styrka eller säkerhet. Boka personlig rådgivning före eventuell örtanvändning.'],
  contraindications:[],interactions:['Fullständiga produkt- och interaktionsuppgifter saknas. Individuell kontroll krävs, särskilt vid läkemedel, andra örter eller kosttillskott.'],
} satisfies Partial<FormulaRecord>;

function sourceFields(id: string) {
  const source = supplierFormulaSources.find(item => item.id === id);
  if (!source) throw new Error(`Missing supplier source: ${id}`);
  return {
    id,name:source.productName,pinyin:source.formulaName,hanzi:'',
    ingredients:source.ingredients.map(herb => `${herb.pinyin} - ${herb.botanicalName}`),
    classicalSource:`Leverantörens benämning i rangejohan.pdf, s. ${source.pages.join(', ')}; inte en självständig verifiering mot klassisk originaltext.`,
    supplierProfile:source,requiresVerification:source.verificationIssues.length > 0,
  };
}

// Swedish matching descriptions and rules below are supplementary TCM
// interpretation. Supplier statements remain separate with page references;
// disease lists never become evidence rules or public therapeutic claims.
export const formulaSeed: readonly FormulaRecord[] = [
  {
    ...common,...sourceFields('supplier-athletic'),swedishName:'Referens vid Njure-Yang-brist med Vind-Kyla-Fukt-Bi',
    primaryPatternIds:['kidneyYangColdDampBi'],secondaryPatternIds:['yangDeficiency','windColdDampBi'],requiredPatternIds:['kidneyYangColdDampBi'],
    supportingRules:[rule('temperature','cold',5),rule('backWeakness','yes',5),rule('weatherPain','yes',4),rule('painWarmth','better',4),rule('painLocation','back_knees',3),rule('stiffness','yes',2)],
    opposingRules:[rule('tongueCoating','scant',4),rule('dryMouth','yes',3),rule('painLocation','head',3)],
    contraindicationRules:[rule('pregnancy','yes'),rule('temperature','hot'),rule('jointWarmth','yes'),rule('painWarmth','worse'),rule('hotPalms','yes'),rule('nightSweats','yes'),rule('tongueCoating',['yellow_greasy','yellow_dry'])],
    requiredQuestionIds:['temperature','backWeakness','weatherPain','painWarmth','jointWarmth','hotPalms','nightSweats','tongueCoating'],
    theoryExplanation:'Jämförs först när frusenhet och ländryggs-/knäsvaghet sammanfaller med väderkänslig värk som lindras av värme. Det avser Zhuang Yao Tang enligt detta leverantörsunderlag, inte den tidigare formeln Du Huo Ji Sheng Tang.',
    scopeLimitation:'Yin-brist med kvällsvärme och torrhet samt Fukt-Hetta talar emot den värmande profilen. Värk eller stelhet ensam visar inte Njure-Yang-brist. Detta är en preliminär TCM-referens för en terapeutbedömning.',
    contraindications:['Leverantören avråder vid graviditet och anger försiktighet vid Yin-brist eller Fukt-Hetta (s. 2).'],
  },
  {
    ...common,...sourceFields('supplier-coptis-scute'),swedishName:'Referens vid kraftig inre överskottshetta/Eld',
    primaryPatternIds:['excessFireToxin'],secondaryPatternIds:['liverFire'],requiredPatternIds:['excessFireToxin'],
    supportingRules:[rule('heatTiming','persistent_strong',5),rule('temperature','hot',4),rule('thirst','strong_cold',4),rule('tongueCoating',['yellow_greasy','yellow_dry'],4),rule('constipation','yes',3)],
    opposingRules:[rule('energy','low',3),rule('weakVoice','yes',3),rule('pallor','yes',3),rule('dryMouth','yes',2)],
    contraindicationRules:[rule('temperature','cold'),rule('heatTiming','evening_night'),rule('tongueCoating','scant'),rule('hotPalms','yes'),rule('nightSweats','yes')],
    requiredQuestionIds:['temperature','heatTiming','thirst','tongueCoating','hotPalms','nightSweats','energy','constipation'],
    theoryExplanation:'Kraftig, ihållande värme, uttalad törst och oberoende överskottsfynd behöver stödja samma mönster. Leverantörens Eld-/toxinterminologi är traditionell TCM och innebär inte att en infektion eller medicinsk orsak har fastställts.',
    scopeLimitation:'Bristhetta vid Yin-brist, kvälls-/nattvärme och allmän svaghet får inte förväxlas med kraftig överskottshetta. Sjukdomsnamnen i leverantörens lista ger inte i sig stöd för denna referens.',
    safetyNotes:[...common.safetyNotes,'De faktiskt ingående råvarorna, berberin-/alkaloidinnehåll och möjliga läkemedelsinteraktioner behöver granskas innan produktstatus kan verifieras. Någon halt, styrka eller riskfrihet har inte fastställts.'],
    contraindications:['Bristpräglad kvälls-/nattvärme eller Kyla passar inte denna kompletterande TCM-matchningsprofil. PDF saknar en fullständig kontraindikationslista.'],
  },
  {
    ...common,...sourceFields('supplier-tonic'),swedishName:'Referens vid Qi- och Blodbrist med Kyla/Yang-brist',
    primaryPatternIds:['qiBloodYangDeficiency'],secondaryPatternIds:['qiBloodDeficiency','yangDeficiency'],requiredPatternIds:['qiBloodYangDeficiency'],
    supportingRules:[rule('temperature','cold',5),rule('energy','low',4),rule('pallor','yes',4),rule('weakVoice','yes',3),rule('dizziness','yes',3),rule('tongueColor','pale',3)],
    opposingRules:[rule('tongueColor','purple',3),rule('foodTrigger','yes',3),rule('appetite','low',2)],
    contraindicationRules:[rule('currentInfection','yes'),rule('temperature','hot'),rule('hotPalms','yes'),rule('thirst','strong_cold'),rule('tongueCoating',['yellow_greasy','yellow_dry'])],
    requiredSafetyRules:[rule('currentInfection','no')],
    requiredQuestionIds:['currentInfection','temperature','energy','pallor','weakVoice','tongueColor','tongueCoating','hotPalms','thirst'],
    theoryExplanation:'Denna leverantörsversion av Shi Quan Da Bu Tang jämförs vid självständigt stöd för Qi-brist och Blodbrist tillsammans med Kyla. Den värmande inriktningen skiljer den från Women’s Herbs/Ba Zhen Tang.',
    tongueIndicators:['Leverantören beskriver blek tunga med tunn vit beläggning (s. 4).'],pulseIndicators:['Leverantören beskriver trådfin och svag puls (s. 4); puls bedöms av behandlare.'],
    contraindications:['Använd inte vid pågående förkylning eller influensa enligt leverantören (s. 4).','Försiktighet vid svag matsmältning enligt leverantören (s. 4).'],
  },
  {
    ...common,...sourceFields('supplier-stomach'),swedishName:'Referens vid Mjälte-Qi-brist med Fukt-Kyla och Qi-stagnation',
    primaryPatternIds:['spleenQiColdDampStagnation'],secondaryPatternIds:['spleenQiDeficiency','spleenDampness','stomachQiStagnation'],requiredPatternIds:['spleenQiColdDampStagnation'],
    supportingRules:[rule('temperature','cold',4),rule('afterMealBloat','yes',4),rule('reflux','belching',4),rule('abdominalPain','distending',4),rule('energy',['low','after_food'],3),rule('appetite','low',3)],
    opposingRules:[rule('tongueMoisture','dry',4),rule('foodTrigger','yes',3),rule('stool','dry',3)],
    contraindicationRules:[rule('temperature','hot'),rule('tongueCoating',['yellow_greasy','yellow_dry']),rule('abdominalPain','burning')],
    requiredQuestionIds:['temperature','afterMealBloat','reflux','abdominalPain','energy','stool','tongueCoating'],
    theoryExplanation:'Kräver en sammansatt bild av Mjälte-Qi-brist, Fukt, Kyla och Qi-stagnation i Magen. Fullhetskänsla, spänd buk eller rapningar hjälper till att skilja från SLBZ:s profil med lös avföring och svag aptit.',
    scopeLimitation:'Födostagnation, torrhet och Fukt-Hetta behöver särskiljas. Produktens ingrediensuppgifter behöver verifieras genom dokumenterat leverantörsbesked; någon faktisk produktordination görs inte.',
    safetyNotes:[...common.safetyNotes,'Produktens ingrediensuppgifter behöver verifieras innan faktisk produkt kan godkännas.'],
  },
  {
    ...common,...sourceFields('supplier-four-marvel'),swedishName:'Referens vid Fukt-Hetta i nedre Jiao',
    primaryPatternIds:['dampHeatLower'],secondaryPatternIds:[],requiredPatternIds:['dampHeatLower'],
    supportingRules:[rule('heaviness','yes',4),rule('tongueCoating','yellow_greasy',4),rule('urination','scant_dark',3),rule('painLocation','lower_limbs',3),rule('temperature','hot',3),rule('edema','yes',2)],
    opposingRules:[rule('tongueCoating','scant',4),rule('dryMouth','yes',3),rule('stool','dry',2)],
    contraindicationRules:[rule('temperature','cold'),rule('tongueCoating','white_greasy')],
    requiredQuestionIds:['heaviness','temperature','tongueCoating','painLocation','urination','jointWarmth'],
    theoryExplanation:'Fukt, Hetta och fynd från nedre delen behöver ha stöd var för sig. Tyngdkänsla eller gul beläggning ensam räcker inte. Kyla/Yang-brist och Yin-brist med torrhet skiljs från denna kalla, Fukt-Hetta-inriktade referens.',
    scopeLimitation:'Urinsveda eller varm/svullen led stoppar den publika formeljämförelsen för medicinsk bedömning. En TCM-likhet fastställer varken orsak eller att produkten är säker för personen.',
    tongueIndicators:['Leverantören nämner gul, fet beläggning som ett traditionellt fynd (s. 7).'],
  },
  {
    ...common,...sourceFields('supplier-relax-resolve'),swedishName:'Referens vid Lever-Qi-stagnation med Blodstas, Hetta och Blodbrist',
    primaryPatternIds:['liverQiStasisHeat'],secondaryPatternIds:['liverQiStagnation','bloodStasis','liverBloodDeficiency'],requiredPatternIds:['liverQiStasisHeat','liverBloodDeficiency'],
    supportingRules:[rule('ribTension','yes',4),rule('stressDigestion','yes',3),rule('painCharacter','stabbing',4),rule('menstrualPain','clots_pain',4),rule('temperature','hot',3),rule('pallor','yes',3),rule('dryEyes','yes',3)],
    opposingRules:[rule('heatTiming','none',4),rule('painCharacter','dull',2),rule('energy','normal',1)],
    contraindicationRules:[rule('currentInfection','yes'),rule('pregnancy','yes'),rule('temperature','cold')],
    requiredSafetyRules:[rule('currentInfection','no')],
    requiredQuestionIds:['currentInfection','ribTension','painCharacter','menstrualPain','temperature','tongueColor','pallor','dryEyes','menstrualFlow'],
    theoryExplanation:'Hua Yu Xiao Yao San är leverantörens modifierade formula, inte oförändrad Xiao Yao San. Separat stöd behövs för Qi-stagnation, Blodstas och Hetta samt den beskrivna Blodbristkomponenten. Att enbart känna stress räcker inte.',
    scopeLimitation:'Auranthii är främst Qi-reglerande; denna referens avser en mer sammansatt brist-/överskottsbild. Om Blodstas, Hetta eller Blodbrist inte stöds väljs inte en full matchning.',
    contraindications:['Använd inte vid Vind-Kyla- eller Vind-Hetta-invasion enligt leverantören (s. 9).','Försiktighet under graviditet enligt leverantören (s. 9); befintlig graviditetsspärr gäller.'],
  },
  {
    ...common,...sourceFields('supplier-six'),swedishName:'Referens vid Lever-/Njure-Yin-brist',
    primaryPatternIds:['kidneyYinDeficiency'],secondaryPatternIds:['dryness'],requiredPatternIds:['kidneyYinDeficiency'],
    supportingRules:[rule('hotPalms','yes',4),rule('dryMouth','yes',3),rule('nightSweats','yes',4),rule('backWeakness','yes',3),rule('tinnitus','yes',3),rule('heatTiming','evening_night',3)],
    opposingRules:[rule('tongueCoating',['white_greasy','yellow_greasy','yellow_dry'],4),rule('heaviness','yes',3),rule('stool','loose',3),rule('edema','yes',3)],
    contraindicationRules:[rule('temperature','cold'),rule('heatTiming','persistent_strong')],
    requiredQuestionIds:['temperature','heatTiming','hotPalms','dryMouth','nightSweats','backWeakness','tongueCoating','heaviness'],
    theoryExplanation:'Kvälls-/nattvärme och torrhet jämförs med ländryggs-/knäsvaghet eller öronbesvär för att skilja Yin-brist från Yang-brist och kraftig överskottshetta. Fuktfynd är en särskild begränsning.',
    scopeLimitation:'Produktens ingrediensuppgifter behöver verifieras genom dokumenterat leverantörsbesked. Inga antaganden görs om faktisk råvara eller beredning.',
    contraindications:['Leverantören anger försiktighet vid Fukt (s. 11).'],
    safetyNotes:[...common.safetyNotes,'Produktens ingrediensuppgifter behöver verifieras innan faktisk produkt kan godkännas.'],
  },
  {
    ...common,...sourceFields('supplier-womens'),swedishName:'Referens vid kombinerad Qi- och Blodbrist',
    primaryPatternIds:['qiBloodDeficiency'],secondaryPatternIds:['spleenQiDeficiency','liverBloodDeficiency'],requiredPatternIds:['qiBloodDeficiency'],
    supportingRules:[rule('energy','low',4),rule('pallor','yes',4),rule('dizziness','yes',3),rule('weakVoice','yes',3),rule('tongueColor','pale',3)],
    opposingRules:[rule('temperature','cold',2),rule('tongueColor','purple',3),rule('heaviness','yes',2)],
    contraindicationRules:[rule('currentInfection','yes'),rule('temperature','hot'),rule('thirst','strong_cold'),rule('tongueCoating',['yellow_greasy','yellow_dry'])],
    requiredSafetyRules:[rule('currentInfection','no')],
    requiredQuestionIds:['currentInfection','temperature','energy','pallor','dizziness','tongueColor','tongueCoating','thirst'],
    theoryExplanation:'Både Qi- och självständiga Blodbristfynd behöver stöd. Produktnamnet Women’s Herbs är leverantörens namn och utgör inte ett könskriterium. Uttalad Kyla/Yang-brist behöver särskiljas från denna mindre Yang-inriktade profil.',
    scopeLimitation:'Vid uttalad Kyla behöver Tonic-profilen jämföras, utan att någon produkt väljs automatiskt. Hetta eller överskott talar emot eller visar att Ba Zhen-referensen inte täcker hela bilden.',
    tongueIndicators:['Leverantören nämner blek tunga (s. 12).'],pulseIndicators:['Leverantören nämner svag puls (s. 12); puls bedöms av behandlare.'],
    contraindications:['Kontraindicerad vid akuta infektioner som förkylning eller influensa enligt leverantören (s. 12).','Leverantören beskriver Hetta/överskott som fel eller otillräcklig inriktning (s. 12).'],
  },
  {
    ...common,...sourceFields('supplier-slbz'),swedishName:'Referens vid Mjälte-Qi-brist med Fukt och lös avföring',
    primaryPatternIds:['spleenDampness'],secondaryPatternIds:['spleenQiDeficiency'],requiredPatternIds:['spleenDampness','spleenQiDeficiency'],
    supportingRules:[rule('stool','loose',5),rule('appetite','low',4),rule('energy',['low','after_food'],4),rule('heaviness','yes',3),rule('weakVoice','yes',2),rule('tongueCoating','white_greasy',3)],
    opposingRules:[rule('reflux','belching',3),rule('abdominalPain','distending',3),rule('temperature','cold',2),rule('tongueMoisture','dry',3)],
    contraindicationRules:[rule('constipation','yes'),rule('stool','dry'),rule('temperature','hot'),rule('tongueCoating',['yellow_greasy','yellow_dry'])],
    requiredQuestionIds:['stool','appetite','energy','heaviness','constipation','temperature','reflux','abdominalPain','tongueCoating'],
    theoryExplanation:'Lös avföring, nedsatt aptit, energisvaghet och Fuktfynd hjälper till att särskilja denna profil från Stomach Herbs med tydligare Kyla och Qi-stagnation. Både brist- och Fuktkomponenten behöver stöd.',
    scopeLimitation:'Hetta och förstoppning talar emot enligt leverantören. Produktens ingrediensuppgifter behöver verifieras genom dokumenterat leverantörsbesked.',
    contraindications:['Inte vid besvär som orsakas av Hetta enligt leverantören (s. 14).','Inte vid förstoppning enligt leverantören (s. 14).'],
    safetyNotes:[...common.safetyNotes,'Produktens ingrediensuppgifter behöver verifieras innan faktisk produkt kan godkännas.'],
  },
  {
    ...common,...sourceFields('supplier-auranthii'),swedishName:'Referens vid Lever-Qi-stagnation med överskottsprägel',
    primaryPatternIds:['liverQiStagnation'],secondaryPatternIds:['liverInvadesSpleen'],requiredPatternIds:['liverQiStagnation'],
    supportingRules:[rule('ribTension','yes',4),rule('stressRelief','yes',3),rule('stressDigestion','yes',3),rule('abdominalPain','distending',3),rule('irritability','yes',2)],
    opposingRules:[rule('pallor','yes',4),rule('weakVoice','yes',3),rule('energy','low',3),rule('painCharacter','stabbing',4),rule('menstrualPain','clots_pain',4),rule('tongueColor','purple',4),rule('thirst','strong_cold',3)],
    requiredQuestionIds:['ribTension','stressRelief','stressDigestion','abdominalPain','pallor','energy','painCharacter','temperature','tongueColor'],
    theoryExplanation:'Framför allt Qi-reglerande referens vid flankspänning, distension och känslorelaterad anspänning med överskottsprägel. Stress utan särskiljande stagnationsfynd är inte tillräckligt.',
    scopeLimitation:'Blodbrist, Blodstas och Hetta behöver bedömas separat; sådana samtidiga mönster täcks inte automatiskt av en Qi-reglerande referens. Auranthii ersätter Astachi i det aktuella sortimentet.',
    contraindications:['Leverantören avråder från långvarig användning utan ny bedömning (s. 16). Ingen individuell behandlingstid eller dosering ges här.'],
  },
].map(formula => FormulaRecordSchema.parse(formula));
