import { z } from 'zod';
import { AnswerMapSchema, type AnswerMap, type FormulaRecord, type PatternAnalysis, type Question, type QuestionId } from './types';
import { questionCovered, questionRelevant } from './answer-context';

const unsure = [{ value: 'unknown', label: 'Vet inte' }, { value: 'prefer_not', label: 'Vill inte svara' }];
const yesNo = [{ value: 'yes', label: 'Ja' }, { value: 'no', label: 'Nej' }];
function q(id: QuestionId, section: string, prompt: string, options: [string,string][] = [], help?: string, professionalOnly = false): Question {
  return { id, section, prompt, help, professionalOnly, options: [...(options.length ? options.map(([value,label]) => ({ value,label })) : yesNo), ...unsure] };
}
export const questionBank: readonly Question[] = [
  q('adult','Trygghet','Är du 18 år eller äldre?'),
  q('pregnancy','Trygghet','Är du gravid, ammar du eller försöker du bli gravid?'),
  q('medication','Trygghet','Använder du läkemedel eller kosttillskott regelbundet?',[],'Även receptfria preparat och örter kan påverka säkerhetsbedömningen.'),
  q('chronicDisease','Trygghet','Har du en pågående eller långvarig sjukdom som behandlas eller följs upp?'),
  q('liverKidney','Trygghet','Har du känd lever- eller njursjukdom eller tidigare avvikande lever-/njurprover?'),
  q('allergy','Trygghet','Har du känd allergi, tidigare kraftig reaktion på läkemedel, örter eller kosttillskott?'),
  q('emergency','Trygghet','Har du just nu bröstsmärta, svår andnöd, plötslig förlamning, förvirring eller tecken på allvarlig allergisk reaktion?',[],'Vid ett akut eller livshotande tillstånd: ring 112. Fortsätt inte formuläret.'),
  q('clinicalRedFlags','Trygghet','Har du blod i avföring eller kräkning, nytillkommen svår smärta, oförklarlig viktnedgång, ihållande feber eller tydligt försämrat allmäntillstånd?',[],'Sådana besvär ska bedömas i hälso- och sjukvården.'),
  q('focus','Bakgrund','Vilket område vill du främst beskriva?',[['digestion','Mage och matsmältning'],['energy','Energi och återhämtning'],['sleep','Sömn och oro'],['stress','Stress och spänning'],['pain','Muskler och leder'],['temperature','Värme, kyla och torrhet'],['immunity','Återkommande infektioner'],['other','Annat eller flera områden']]),
  q('duration','Bakgrund','Hur länge har besvären funnits?',[['days','Dagar'],['weeks','Veckor'],['months','Månader'],['years','År']]),
  q('onset','Bakgrund','Hur började besvären?',[['gradual','Gradvis'],['sudden','Plötsligt'],['after_illness','Efter sjukdom'],['after_stress','Efter belastning eller stress'],['after_food','Efter en måltid']]),
  q('trend','Bakgrund','Hur har besvären utvecklats?',[['stable','Ungefär oförändrade'],['improving','Blivit bättre'],['worsening','Blivit tydligt värre'],['variable','Kommer och går']]),
  // Retain the label for historical records; never ask it in a new intake.
  {...q('priorAssessment','Bakgrund','Har de aktuella besvären bedömts av legitimerad vårdpersonal?',[['yes','Ja'],['no','Nej'],['scheduled','Undersökning är planerad']]), retired: true},
  q('temperature','Temperatur och vätskor','Hur brukar du uppleva din kroppstemperatur?',[['cold','Ofta frusen'],['hot','Ofta varm'],['mixed','Växlar mellan varmt och kallt'],['neutral','Ingen tydlig avvikelse']]),
  q('heatTiming','Temperatur och vätskor','Om du upplever värme, när och hur märks den?',[['persistent_strong','Tydlig och ihållande värmekänsla större delen av dagen'],['evening_night','Främst på kvällen eller natten, ibland i handflator eller fotsulor'],['none','Ingen tydlig värmekänsla']], 'Beskriv din vanliga upplevelse, inte uppmätt feber. Ihållande feber eller försämrat allmäntillstånd tas upp i trygghetsfrågorna.'),
  q('thirst','Temperatur och vätskor','Hur upplever du törst?',[['strong_cold','Mycket törstig, föredrar kall dryck'],['small_sips','Torr eller törstig men dricker lite i taget'],['low','Sällan törstig'],['normal','Ingen tydlig avvikelse']]),
  q('sweating','Temperatur och vätskor','När märker du framför allt svettning?',[['spontaneous','Lätt utan ansträngning'],['night','Under natten'],['exertion','Främst vid ansträngning eller värme'],['little','Svettas sällan'],['normal','Ingen tydlig avvikelse']]),
  q('energy','Energi','Hur upplever du din energi?',[['low','Låg större delen av dagen'],['after_food','Trött framför allt efter mat'],['restless','Rastlös trots trötthet'],['normal','Tillräcklig energi']]),
  q('appetite','Matsmältning','Hur är din aptit?',[['low','Minskad aptit'],['high','Ovanligt hungrig'],['variable','Växlar mycket'],['normal','Ingen tydlig avvikelse']]),
  q('stool','Matsmältning','Vilken beskrivning stämmer oftast med din avföring?',[['loose','Lös'],['dry','Torr eller hård'],['alternating','Växlar mellan lös och hård'],['sticky','Kladdig och svår att spola bort'],['normal','Formad utan tydliga besvär']]),
  q('sleep','Sömn och känsloliv','Hur upplever du sömnen?',[['difficulty','Svårt att somna'],['waking','Vaknar ofta'],['unrested','Sover men känner mig inte utvilad'],['normal','Oftast god sömn']]),
  q('emotion','Sömn och känsloliv','Vad märker du oftast känslomässigt?',[['worry','Oro och grubblande'],['irritable','Irritation och frustration'],['low','Nedstämdhet'],['calm','Vanligen lugn']]),
  q('pain','Smärta och rörelse','Har du återkommande eller ihållande värk eller stelhet i muskler eller leder?',[], 'Bukbesvär beskriver du separat i frågorna om matsmältning.'),
  q('stressDigestion','Matsmältning','Förändras magbesvären tydligt av stress eller känslomässig belastning?'),
  q('afterMealBloat','Matsmältning','Blir du uppblåst eller obehagligt mätt efter måltider?'),
  q('nausea','Matsmältning','Har du återkommande illamående eller kväljningar?'),
  q('reflux','Matsmältning','Har du sura uppstötningar, rapningar eller reflux?',[['sour','Sura uppstötningar'],['belching','Rapningar som kan lindra tryck'],['none','Inget av detta']]),
  q('abdominalPain','Matsmältning','Hur känns eventuella bukbesvär?',[['dull','Dovt och långvarigt'],['distending','Spänt eller uppblåst'],['cramping','Krampartat eller i omgångar'],['burning','Brännande'],['sharp','Skarpt och på samma plats'],['none','Ingen buksmärta']]),
  q('bowelRelief','Matsmältning','Lindras bukbesvär efter avföring eller gasavgång?'),
  q('foodTrigger','Matsmältning','Är fullhet och magbesvär tydligt kopplade till stora eller svårsmälta måltider?'),
  q('stoolOdor','Matsmältning','Är lös avföring samtidigt ovanligt illaluktande och förenad med sveda eller stark brådska?'),
  q('constipation','Matsmältning','Har du återkommande förstoppning?'),
  q('sinking','Energi','Upplever du en återkommande nedåtdragande tyngdkänsla i buken?'),
  q('weakVoice','Energi','Blir rösten svag eller trött lätt?'),
  q('exertion','Energi','Hur påverkas du av vanlig vardagsansträngning?',[['tired','Blir lätt kraftlös och behöver vila'],['better','Känner mig ofta bättre av mild rörelse'],['normal','Ingen tydlig avvikelse']]),
  q('frequentInfections','Luftvägar','Har du återkommande luftvägsinfektioner med full återhämtning mellan episoderna?'),
  q('currentInfection','Luftvägar','Har du just nu en förkylning, influensa eller annan pågående infektion?',[], 'Skilj på återkommande besvär mellan vilka du återhämtar dig och en infektion som pågår nu. Svår sjukdom, ihållande feber eller försämrat allmäntillstånd hör till trygghetsfrågorna.'),
  q('windSensitivity','Luftvägar','Är du särskilt känslig för drag eller vind?'),
  q('cough','Luftvägar','Har du hosta?',[['dry','Torrhosta'],['productive','Hosta med slem'],['none','Ingen hosta']]),
  q('phlegm','Luftvägar','Om du har slem, hur brukar det vara?',[['clear','Ljust eller genomskinligt'],['yellow','Gult och segt'],['none','Inget slem']]),
  q('breathing','Luftvägar','Blir du lätt andfådd vid lätt ansträngning?',[],'Ny, tilltagande eller oförklarlig andfåddhet behöver medicinsk bedömning.'),
  q('chestTightness','Luftvägar','Har du återkommande brösttryck eller trånghetskänsla?',[],'Pågående bröstsmärta eller svår andnöd: avbryt och sök akut hjälp.'),
  q('sleepOnset','Sömn och känsloliv','Har du svårt att varva ned och somna?'),
  q('nightWaking','Sömn och känsloliv','Vaknar du flera gånger under natten?'),
  q('dreams','Sömn och känsloliv','Upplever du många livliga drömmar som stör vilan?'),
  q('rumination','Sömn och känsloliv','Fastnar du ofta i grubblande eller oro?'),
  q('palpitations','Sömn och känsloliv','Har du återkommande hjärtklappning?',[],'Ny eller oförklarlig hjärtklappning behöver medicinsk bedömning.'),
  q('mentalFatigue','Sömn och känsloliv','Har du återkommande mental trötthet eller svårt att koncentrera dig?'),
  q('irritability','Sömn och känsloliv','Blir du lätt irriterad eller frustrerad?'),
  q('ribTension','Sömn och känsloliv','Upplever du spänning under revbensbågarna?'),
  q('stressRelief','Sömn och känsloliv','Lindras spänning av avslappning, suckar eller mjuk rörelse?'),
  q('pallor','Blod och vätskor','Har du lagt märke till ovanlig blekhet i ansikte eller läppar?'),
  q('dizziness','Blod och vätskor','Har du återkommande yrsel?',[],'Nytillkommen eller kraftig yrsel, svimning eller neurologiska symtom ska bedömas i vården.'),
  q('dryEyes','Blod och vätskor','Har du ofta torra eller trötta ögon?'),
  q('hairNails','Blod och vätskor','Har du lagt märke till återkommande sköra naglar eller torrt hår?'),
  q('menstruation','Blod och vätskor','Om du menstruerar, påverkas besvären av menstruationscykeln?',[['yes','Ja'],['no','Nej'],['not_applicable','Inte aktuellt']]),
  q('menstrualFlow','Blod och vätskor','Om du menstruerar, hur är blödningen?',[['scant','Sparsam'],['heavy','Riklig'],['normal','Ingen tydlig avvikelse'],['not_applicable','Inte aktuellt']]),
  q('menstrualPain','Blod och vätskor','Om du menstruerar, har du smärta och/eller mörka klumpar?',[['clots_pain','Mörka klumpar med tydlig smärta'],['mild','Lätta besvär'],['none','Inga sådana besvär'],['not_applicable','Inte aktuellt']]),
  q('nightSweats','Temperatur och vätskor','Svettas du återkommande under natten?'),
  q('hotPalms','Temperatur och vätskor','Känner du värme i handflator eller fotsulor, särskilt på kvällen?'),
  q('dryMouth','Temperatur och vätskor','Är du ofta torr i mun eller hals, särskilt kvällstid?'),
  q('tinnitus','Blod och vätskor','Har du återkommande öronsusningar?',[],'Plötslig hörselnedsättning eller nytillkommet ensidigt besvär bör bedömas i vården.'),
  q('backWeakness','Smärta och rörelse','Har du långvarig svaghetskänsla eller dov värk i ländrygg och knän?'),
  q('urination','Blod och vätskor','Har du besvär när du urinerar?',[['burning','Sveda eller täta trängningar'],['frequent_clear','Ofta stora mängder ljus urin'],['scant_dark','Små mängder mörk urin'],['normal','Ingen tydlig avvikelse']]),
  q('edema','Blod och vätskor','Har du återkommande svullnad i ben eller andra kroppsdelar?'),
  q('heaviness','Blod och vätskor','Upplever du tunghet eller tröghet i kroppen?'),
  q('painLocation','Smärta och rörelse','Var sitter värken framför allt?',[['joints','Leder'],['back_knees','Ländrygg och knän'],['lower_limbs','Underben, fotleder eller fötter'],['muscles','Muskler'],['head','Huvud'],['abdomen','Mage'],['none','Ingen värk']]),
  q('painCharacter','Smärta och rörelse','Hur skulle du beskriva värken?',[['dull','Dov eller molande'],['distending','Spänd eller vandrande'],['stabbing','Stickande och fixerad på samma plats'],['burning','Brännande'],['none','Ingen värk']]),
  q('painWarmth','Smärta och rörelse','Hur påverkas värken av värme?',[['better','Lindras av värme'],['worse','Förvärras av värme'],['neutral','Ingen tydlig skillnad'],['not_applicable','Inte aktuellt']]),
  q('painMovement','Smärta och rörelse','Hur påverkas värken av mjuk rörelse?',[['better','Lindras'],['worse','Förvärras, vila hjälper'],['neutral','Ingen tydlig skillnad'],['not_applicable','Inte aktuellt']]),
  q('weatherPain','Smärta och rörelse','Blir värk eller stelhet tydligt värre vid kyla, fukt eller väderomslag?'),
  q('jointWarmth','Smärta och rörelse','Är en led röd, varm eller svullen?',[],'En nytillkommen varm eller svullen led behöver medicinsk bedömning.'),
  q('stiffness','Smärta och rörelse','Har du återkommande stelhet som begränsar rörelsen?'),
  q('tongueColor','Frivilliga tungobservationer','Vilken färg tycker du att tungan har?',[['pale','Blek'],['red','Tydligt röd'],['purple','Lila eller mörkröd'],['normal','Ingen tydlig avvikelse']], 'Frivillig observation i naturligt ljus, utan att tolka ett foto som diagnos.'),
  q('tongueShape','Frivilliga tungobservationer','Hur ser tungans form ut?',[['swollen','Bred eller svullen'],['thin','Smal eller tunn'],['normal','Ingen tydlig avvikelse']]),
  q('tongueCoating','Frivilliga tungobservationer','Hur ser tungans beläggning ut?',[['white_greasy','Vit och tjock eller kladdig'],['yellow_greasy','Gul och tjock eller kladdig'],['yellow_dry','Gul och tydligt torr'],['scant','Mycket tunn eller saknas'],['normal','Tunn utan tydlig avvikelse']]),
  q('tongueCracks','Frivilliga tungobservationer','Har du lagt märke till tydliga sprickor i tungan?'),
  q('tongueTeeth','Frivilliga tungobservationer','Har du lagt märke till tandavtryck längs tungans kanter?'),
  q('tongueMoisture','Frivilliga tungobservationer','Hur upplever du tungans fuktighet?',[['dry','Torr'],['wet','Påtagligt våt'],['normal','Ingen tydlig avvikelse']]),
  q('pulse','Behandlarobservation','Vilken pulskvalitet har behandlaren dokumenterat?',[['weak','Svag'],['wiry','Strängformig'],['rapid','Snabb'],['slow','Långsam'],['slippery','Halkande'],['thin','Tunn'],['normal','Ingen tydlig avvikelse']], 'Endast för behörig behandlares komplettering. Besökaren ska inte själv bedöma sin puls.', true),
];
export const questionById = new Map<QuestionId, Question>(questionBank.map(question => [question.id, question]));
export const isPublicQuestion = (question: Question) => !question.professionalOnly && !question.retired;
export const baseQuestionIds: readonly QuestionId[] = ['adult','pregnancy','medication','chronicDisease','liverKidney','allergy','emergency','clinicalRedFlags','focus','duration','onset','trend','temperature','thirst','sweating','energy','appetite','stool','sleep','emotion','pain','stressDigestion'];
const focusedQuestionIds: Record<string, QuestionId[]> = {
  digestion: ['afterMealBloat','nausea','foodTrigger','reflux','abdominalPain','tongueCoating'],
  energy: ['weakVoice','exertion','pallor','dizziness','sinking','tongueColor'],
  sleep: ['sleepOnset','nightWaking','rumination','palpitations','nightSweats','tongueColor'],
  stress: ['ribTension','irritability','stressRelief','afterMealBloat','pallor','tongueColor'],
  pain: ['painLocation','painCharacter','painWarmth','weatherPain','jointWarmth','backWeakness'],
  temperature: ['hotPalms','nightSweats','dryMouth','backWeakness','urination','tongueColor'],
  immunity: ['frequentInfections','currentInfection','weakVoice','windSensitivity','cough','phlegm','tongueCoating'],
  other: ['afterMealBloat','pallor','nightSweats','painCharacter','heaviness','tongueColor'],
};
export function answerLabel(questionId: QuestionId, answer: string | undefined): string {
  return questionById.get(questionId)?.options.find(option => option.value === answer)?.label ?? 'Ej besvarat';
}
export function validateAnswers(input: unknown, options: { allowProfessional?: boolean } = {}): AnswerMap {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    if (![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(id => !questionById.has(id as QuestionId))) {
      throw new z.ZodError([{code:'custom',path:[],message:'Endast kända frågor i ett vanligt svarsobjekt tillåts.'}]);
    }
  }
  const parsed = AnswerMapSchema.parse(input);
  const issues: z.core.$ZodIssue[] = [];
  for (const [id, value] of Object.entries(parsed)) {
    const question = questionById.get(id as QuestionId);
    if (!question || (question.professionalOnly && !options.allowProfessional) || !question.options.some(option => option.value === value)) {
      issues.push({ code: 'custom', path: [id], message: 'Välj ett giltigt svar i frågebanken.' });
    }
  }
  if (issues.length) throw new z.ZodError(issues);
  return parsed;
}
export function getInitialQuestions(answers: AnswerMap = {}): Question[] {
  const extra = focusedQuestionIds[answers.focus ?? ''] ?? [];
  return [...baseQuestionIds, ...extra].map(id => questionById.get(id)!);
}
export const getAdaptiveQuestions = getInitialQuestions;
export function getFollowupQuestions(answers: AnswerMap, analysis: PatternAnalysis, selectedIds: readonly QuestionId[] = []): Question[] {
  const initial = new Set(getInitialQuestions(answers).map(question => question.id));
  const missing = analysis.patterns.slice(0,4).flatMap(pattern => pattern.missingQuestionIds);
  const candidates = [...selectedIds, ...missing, 'tongueCoating', 'tongueColor', 'painCharacter', 'hotPalms', 'pallor'] as QuestionId[];
  return [...new Set(candidates)].filter(id => {
    const question = questionById.get(id);
    return question && isPublicQuestion(question) && !initial.has(id) && !questionCovered(answers,id) && questionRelevant(answers,id);
  }).slice(0,5).map(id => questionById.get(id)!);
}
export function validateFormulaRules(formula: FormulaRecord): boolean {
  return [...formula.supportingRules,...formula.opposingRules,...formula.contraindicationRules,...formula.requiredSafetyRules].every(rule => {
    const question = questionById.get(rule.questionId);
    return question && !question.professionalOnly && rule.values.every(value => !['unknown','prefer_not'].includes(value) && question.options.some(option => option.value === value));
  }) && formula.requiredQuestionIds.every(id => questionById.has(id) && !questionById.get(id)!.professionalOnly);
}
