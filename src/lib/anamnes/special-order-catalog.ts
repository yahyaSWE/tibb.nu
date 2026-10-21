import book from './special-order-source.json';
import { FormulaRecordSchema, ReferenceSourceSchema, type FormulaRecord, type PatternId } from './types';
import { patternById, rule } from './patterns';

// Private source material: imported only by the server catalog and admin page.
// The model receives the independent pattern guide, never this product list.
export const specialOrderSourceLibrary = book.map(entry => ReferenceSourceSchema.parse(entry));

export function specialOrderDraft(id: string): FormulaRecord | null {
  const source = specialOrderSourceLibrary.find(entry => entry.id === id);
  if (!source) return null;
  return {
    id:source.id,name:source.productName,pinyin:'',hanzi:'',swedishName:'Specialbeställningsreferens inför rådgivning',active:false,
    primaryPatternIds:[],secondaryPatternIds:[],requiredPatternIds:[],supportingRules:[],opposingRules:[],requiredQuestionIds:[],contraindicationRules:[],requiredSafetyRules:[],
    theoryExplanation:'',scopeLimitation:'Referens ur en separat dokumentkatalog. Den faktiska slutprodukten, innehållet och lämpligheten behöver bedömas före eventuell specialbeställning.',
    safetyNotes:['Specialbeställning förutsätter personlig rådgivning och kontroll av faktisk produkt, innehåll och säkerhet.'],contraindications:[],interactions:['Fullständiga produkt- och interaktionsuppgifter behöver verifieras.'],ingredients:[],tongueIndicators:[],pulseIndicators:[],
    classicalSource:'',identityEvidence:'',ingredientEvidence:'',safetyEvidence:'',regulatoryEvidence:'',productId:null,productUrl:null,
    productIdentityVerified:false,ingredientsVerified:false,safetyVerified:false,regulatoryVerified:false,supplierProfile:null,requiresVerification:false,verificationResolution:'',
    referenceKind:'special_order',referenceSource:source,
  };
}

const mappings: {page:number;name:string;pinyin:string;pattern:PatternId;explanation:string;required?:PatternId[]}[] = [
  {page:5,name:'Air',pinyin:'Qing Zao Jiu Fei Tang',pattern:'dryness',explanation:'Dokumentet beskriver en torrhetsinriktad referens med torrhosta. Torrhet behöver särskiljas från Fukt/Slem och orsaken till hostan behöver bedömas.'},
  {page:20,name:'Bu Zhong Yi Qi Pian',pinyin:'Bu Zhong Yi Qi Pian',pattern:'qiSinking',explanation:'Dokumentreferens vid en självständigt underbyggd Qi-brist med nedåtdragande tyngdkänsla. En känsla av tyngd fastställer inte att ett organ har sjunkit.'},
  {page:37,name:'Destagnation',pinyin:'Xue Fu Zhu Yu Pian',pattern:'bloodStasis',explanation:'Dokumentet beskriver en Blodstas-inriktad referens. Den jämförs bara när särskiljande stasfynd har stöd, inte utifrån allmän smärta eller stress.'},
  {page:40,name:'Diges',pinyin:'Bao He Wan',pattern:'foodStagnation',explanation:'Dokumentreferens vid ett underbyggt mönster av födostagnation med måltidskopplad fullhet och rapningar. Skilj från Qi-brist, Fukt-Kyla och stressrelaterade besvär.'},
  {page:41,name:'Du Huo Ji Sheng Tang',pinyin:'Du Huo Ji Sheng Tang',pattern:'chronicBiDeficiency',explanation:'Dokumentet beskriver långvarig väderkänslig värk med bristfynd och dragning till värme. Det är en separat produktversion och ersätter inte Athletic Herbs.'},
  {page:61,name:'Gui Pi Tang',pinyin:'Gui Pi Tang',pattern:'heartSpleenDeficiency',explanation:'Dokumentreferens för en kombinerad Hjärt-/Mjälte-bristprofil. Hjärtklappning och andra säkerhetsflaggor prioriterar individuell medicinsk bedömning och stoppar publik matchning.'},
  {page:110,name:'Si Jun Zi Tang',pinyin:'Si Jun Zi Tang',pattern:'spleenQiDeficiency',explanation:'Dokumentreferens vid en underbyggd Mjälte-Qi-brist med låg energi och svag matsmältning. Samtidig Kyla, Fukt och stagnation behöver särskiljas.'},
  {page:113,name:'Si Wu Tang',pinyin:'Si Wu Tang',pattern:'liverBloodDeficiency',explanation:'Dokumentet beskriver en Blodrelaterad referens. Matchningen bygger på oberoende TCM-fynd och betyder inte att anemi eller annan blodsjukdom har fastställts.'},
  {page:114,name:'Suan Zao Ren Tang',pinyin:'Suan Zao Ren Tang',pattern:'liverBloodShenDisturbance',explanation:'Dokumentreferens vid sömnsvårigheter tillsammans med underbyggda Lever-Blodbristfynd. Enbart sömnproblem eller stress räcker inte.'},
  {page:130,name:'Xiao Yao San',pinyin:'Xiao Yao San',pattern:'liverSpleenBloodDeficiency',explanation:'Dokumentreferens vid kombinationen Lever-Qi-stagnation, Mjälte-Qi-brist och Blodbrist. Den ska inte förväxlas med Hua Yu Xiao Yao San i det ordinarie sortimentet.'},
  {page:136,name:'Yu Ping Feng San',pinyin:'Yu Ping Feng San',pattern:'lungWeiQiDeficiency',explanation:'Dokumentreferens vid återkommande besvär med full återhämtning mellan episoderna och underbyggda Wei-Qi-bristfynd. Pågående infektion måste särskiljas.'},
];

export const specialOrderSeed: readonly FormulaRecord[] = mappings.map(mapping => {
  const pattern = patternById.get(mapping.pattern)!;
  const draft = specialOrderDraft(`special-book-${String(mapping.page).padStart(3,'0')}`)!;
  return FormulaRecordSchema.parse({...draft,name:mapping.name,pinyin:mapping.pinyin,active:true,primaryPatternIds:[mapping.pattern],requiredPatternIds:mapping.required ?? [mapping.pattern],
    supportingRules:pattern.supportingRules,opposingRules:pattern.opposingRules,requiredQuestionIds:[...pattern.requiredQuestionIds,'currentInfection'],requiredSafetyRules:[rule('currentInfection','no')],
    contraindicationRules:[rule('currentInfection','yes'),rule('pregnancy','yes')],theoryExplanation:mapping.explanation,
    ...(mapping.page === 5 ? {requiredSafetyRules:[rule('currentInfection','no'),rule('cough','dry')]} : {}),
  });
});
