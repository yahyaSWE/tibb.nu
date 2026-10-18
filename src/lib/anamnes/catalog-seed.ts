import { rule } from './patterns';
import { FormulaRecordSchema, type FormulaRecord } from './types';

const common = {
  active:true,pinyin:'',hanzi:'',swedishName:'',secondaryPatternIds:[],requiredPatternIds:[],requiredQuestionIds:[],
  supportingRules:[],opposingRules:[],theoryExplanation:'',scopeLimitation:'Kräver en självständig bedömning av hela mönsterbilden; en delmatchning räcker inte för val av örtprodukt.',
  // No supplier recipe, ingredient, safety or regulatory claim is inferred from
  // a classical formula name. The practitioner must provide actual documents.
  ingredients:[],tongueIndicators:[],pulseIndicators:[],classicalSource:'',identityEvidence:'',ingredientEvidence:'',safetyEvidence:'',regulatoryEvidence:'',
  productId:null,productUrl:null,productIdentityVerified:false,ingredientsVerified:false,safetyVerified:false,regulatoryVerified:false,
  safetyNotes:['Produktens exakta innehåll och säkerhetsuppgifter är ännu inte verifierade. Namnet är en klassisk referens, inte en tillgänglig eller godkänd produkt.'],
  contraindications:[],interactions:[],
} satisfies Partial<FormulaRecord>;

// These profiles are educational matching criteria supplied in the project
// brief. They are not clinically validated or verified China Nature products.
export const formulaSeed: readonly FormulaRecord[] = [
  {
    ...common,id:'xiao-yao-san',name:'Xiao Yao San',pinyin:'Xiao Yao San',swedishName:'Referens vid stagnation med Mjälte-Qi- och Blodbrist',
    primaryPatternIds:['liverSpleenBloodDeficiency'],secondaryPatternIds:['liverInvadesSpleen','spleenQiDeficiency','liverBloodDeficiency'],requiredPatternIds:['liverSpleenBloodDeficiency'],
    supportingRules:[rule('stressDigestion','yes',4),rule('energy','low',3),rule('pallor','yes',4),rule('ribTension','yes',3)],
    opposingRules:[rule('thirst','strong_cold',4),rule('tongueCoating','yellow_greasy',4),rule('foodTrigger','yes',3)],requiredQuestionIds:['stressDigestion','pallor','energy','ribTension'],
    theoryExplanation:'Jämförs först när både Lever-Qi-stagnation, Mjälte-Qi-brist och Blodbrist har självständigt stöd. Stress och uppblåsthet ensamma räcker inte.',
  },
  {
    ...common,id:'xiang-sha-liu-jun-zi-tang',name:'Xiang Sha Liu Jun Zi Tang',pinyin:'Xiang Sha Liu Jun Zi Tang',swedishName:'Referens vid Mjälte-Qi-brist med Fukt och Qi-stagnation',
    primaryPatternIds:['spleenDampness'],secondaryPatternIds:['spleenQiDeficiency','stomachQiStagnation'],requiredPatternIds:['spleenDampness','stomachQiStagnation'],
    supportingRules:[rule('heaviness','yes',4),rule('afterMealBloat','yes',4),rule('nausea','yes',3),rule('appetite','low',3)],
    opposingRules:[rule('tongueMoisture','dry',4),rule('tongueCoating','yellow_greasy',4),rule('foodTrigger','yes',3)],requiredQuestionIds:['heaviness','afterMealBloat','reflux','tongueCoating'],
    theoryExplanation:'Jämförs när brist och Fukt sammanfaller med självständiga tecken på Mag-Qi-stagnation. Födostagnation, torrhet och Fukt-Hetta behöver särskiljas.',
  },
  {
    ...common,id:'bu-zhong-yi-qi-tang',name:'Bu Zhong Yi Qi Tang',pinyin:'Bu Zhong Yi Qi Tang',swedishName:'Referens vid Qi-brist med sjunkande Qi',
    primaryPatternIds:['qiSinking'],secondaryPatternIds:['spleenQiDeficiency'],requiredPatternIds:['qiSinking'],
    supportingRules:[rule('sinking','yes',5),rule('energy','low',3),rule('weakVoice','yes',3),rule('exertion','tired',3)],opposingRules:[rule('sinking','no',5),rule('tongueCoating','yellow_greasy',3)],requiredQuestionIds:['sinking','weakVoice','energy'],
    theoryExplanation:'Sjunkande Qi måste ha särskiljande stöd. Allmän trötthet eller lös avföring utan sådana fynd räcker inte.',
  },
  {
    ...common,id:'suan-zao-ren-tang',name:'Suan Zao Ren Tang',pinyin:'Suan Zao Ren Tang',swedishName:'Referens vid Lever-Blodbrist med sömnoro',
    primaryPatternIds:['liverBloodShenDisturbance'],secondaryPatternIds:['liverBloodDeficiency'],requiredPatternIds:['liverBloodShenDisturbance'],
    supportingRules:[rule('sleepOnset','yes',4),rule('pallor','yes',4),rule('dizziness','yes',3),rule('nightWaking','yes',3)],opposingRules:[rule('thirst','strong_cold',4),rule('tongueCoating','yellow_greasy',4)],requiredQuestionIds:['sleepOnset','pallor','dizziness'],
    theoryExplanation:'Sömnoro måste här sammanfalla med stöd för Lever-Blodbrist. Formeln är inte en generell referens för alla sömnproblem.',
  },
  {
    ...common,id:'yu-ping-feng-san',name:'Yu Ping Feng San',pinyin:'Yu Ping Feng San',swedishName:'Referens vid Lung-/Wei Qi-brist',
    primaryPatternIds:['lungWeiQiDeficiency'],secondaryPatternIds:[],requiredPatternIds:['lungWeiQiDeficiency'],
    supportingRules:[rule('frequentInfections','yes',5),rule('sweating','spontaneous',4),rule('weakVoice','yes',3),rule('windSensitivity','yes',3)],opposingRules:[rule('duration','days',4),rule('temperature','hot',4),rule('phlegm','yellow',4)],requiredQuestionIds:['frequentInfections','sweating','duration','phlegm'],
    theoryExplanation:'Jämförs vid återkommande bristpräglade besvär mellan episoder, inte vid en pågående akut infektion eller tydliga värmetecken.',
  },
  {
    ...common,id:'gui-pi-tang',name:'Gui Pi Tang',pinyin:'Gui Pi Tang',swedishName:'Referens vid kombinerad Hjärt-/Mjältebrist',
    primaryPatternIds:['heartSpleenDeficiency'],secondaryPatternIds:['heartBloodDeficiency','spleenQiDeficiency'],requiredPatternIds:['heartSpleenDeficiency'],
    supportingRules:[rule('palpitations','yes',4),rule('appetite','low',3),rule('energy','low',3),rule('rumination','yes',3)],opposingRules:[rule('thirst','strong_cold',4),rule('tongueCoating','yellow_greasy',4)],requiredQuestionIds:['palpitations','appetite','pallor'],
    theoryExplanation:'Jämförs endast när både Hjärt-Blodbrist och Mjälte-Qi-brist har stöd. Hjärtklappning behöver medicinsk bedömning, oavsett TCM-mönster.',
  },
  {
    ...common,id:'ba-zhen-tang',name:'Ba Zhen Tang',pinyin:'Ba Zhen Tang',swedishName:'Referens vid kombinerad Qi- och Blodbrist',
    primaryPatternIds:['qiBloodDeficiency'],secondaryPatternIds:['spleenQiDeficiency','liverBloodDeficiency','heartBloodDeficiency'],requiredPatternIds:['qiBloodDeficiency'],
    supportingRules:[rule('energy','low',4),rule('pallor','yes',4),rule('dizziness','yes',3),rule('weakVoice','yes',3)],opposingRules:[rule('tongueCoating','yellow_greasy',4),rule('temperature','hot',3),rule('tongueColor','purple',3)],requiredQuestionIds:['energy','pallor','dizziness','tongueColor'],
    theoryExplanation:'Både Qi- och Blodbrist behöver ha självständigt stöd. Blekhet, yrsel och trötthet kan behöva medicinsk utredning.',
  },
  {
    ...common,id:'du-huo-ji-sheng-tang',name:'Du Huo Ji Sheng Tang',pinyin:'Du Huo Ji Sheng Tang',swedishName:'Referens vid långvarigt kallt/fuktigt Bi med underliggande brist',
    primaryPatternIds:['chronicBiDeficiency'],secondaryPatternIds:['windColdDampBi'],requiredPatternIds:['chronicBiDeficiency','windColdDampBi'],
    supportingRules:[rule('weatherPain','yes',4),rule('painWarmth','better',4),rule('backWeakness','yes',4),rule('duration',['months','years'],2)],opposingRules:[rule('jointWarmth','yes',5),rule('painWarmth','worse',4),rule('duration','days',4)],requiredQuestionIds:['duration','weatherPain','painWarmth','backWeakness','jointWarmth'],
    theoryExplanation:'Kräver ett långvarigt Vind-Kyla-Fukt-Bi-mönster med särskiljande bristfynd. Varm eller svullen led passar inte denna profil.',
  },
  {
    ...common,id:'si-miao-san',name:'Si Miao San',pinyin:'Si Miao San',swedishName:'Referens vid Fukt-Hetta i nedre Jiao',
    primaryPatternIds:['dampHeatLower'],secondaryPatternIds:[],requiredPatternIds:['dampHeatLower'],
    supportingRules:[rule('heaviness','yes',3),rule('tongueCoating','yellow_greasy',4),rule('stoolOdor','yes',3),rule('urination','burning',4)],opposingRules:[rule('temperature','cold',4),rule('tongueCoating','white_greasy',4)],requiredQuestionIds:['heaviness','tongueCoating','urination','jointWarmth'],
    theoryExplanation:'Jämförs endast när Fukt och Hetta har stöd samtidigt. Urinsveda och varm/svullen led stoppar den publika formeljämförelsen för medicinsk bedömning.',
  },
  {
    ...common,id:'liu-wei-di-huang-wan',name:'Liu Wei Di Huang Wan',pinyin:'Liu Wei Di Huang Wan',swedishName:'Referens vid Lever-/Njure-Yin-brist',
    primaryPatternIds:['kidneyYinDeficiency'],secondaryPatternIds:['dryness'],requiredPatternIds:['kidneyYinDeficiency'],
    supportingRules:[rule('hotPalms','yes',4),rule('dryMouth','yes',3),rule('nightSweats','yes',4),rule('backWeakness','yes',3),rule('tinnitus','yes',3)],opposingRules:[rule('temperature','cold',4),rule('tongueCoating',['white_greasy','yellow_greasy'],4)],requiredQuestionIds:['hotPalms','dryMouth','backWeakness','tongueCoating'],
    theoryExplanation:'Torrhet och kvällsvärme jämförs med underliggande Yin-brist. Full Hetta, Yang-brist och Fukt kan tala emot profilen.',
  },
].map(formula => FormulaRecordSchema.parse(formula));
