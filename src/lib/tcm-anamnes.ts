/**
 * Utbildningsinriktad TCM-mönsterorientering – inte medicinsk diagnos eller behandlingsråd.
 * Allt beräknas lokalt hos användaren; inget skickas till en server.
 */

export const focusOptions = [
  { id: 'stress', label: 'Stress och känslomässig belastning' },
  { id: 'digestion', label: 'Mage och matsmältning' },
  { id: 'energy', label: 'Energi och återhämtning' },
  { id: 'sleep', label: 'Sömn och vila' },
  { id: 'joints', label: 'Muskler och leder' },
  { id: 'heat', label: 'Värme, torrhet eller temperatur' },
  { id: 'immunity', label: 'Återkommande infektioner / återhämtning' },
] as const;
export type Focus = (typeof focusOptions)[number]['id'];

export const symptomGroups = [
  { title: 'Mage och matsmältning', items: [
    { id: 'stressGut', label: 'Magen påverkas tydligt av stress eller oro' },
    { id: 'afterMealBloat', label: 'Uppblåsthet eller fullhet efter måltider' },
    { id: 'lowAppetite', label: 'Dålig aptit' },
    { id: 'looseStool', label: 'Ofta lös avföring' },
    { id: 'nausea', label: 'Illamående eller långvarig fullhetskänsla' },
    { id: 'sinking', label: 'Nedåtdragande tyngdkänsla i buken' },
  ]},
  { title: 'Energi och återhämtning', items: [
    { id: 'lowEnergy', label: 'Låg energi större delen av dagen' },
    { id: 'weakVoice', label: 'Svag röst eller lätt andfådd vid ansträngning' },
    { id: 'spontSweat', label: 'Svettas lätt utan ansträngning' },
    { id: 'frequentSick', label: 'Återkommande infektioner eller långsam återhämtning' },
    { id: 'pale', label: 'Ser ofta blek ut' },
    { id: 'dizzy', label: 'Återkommande yrsel eller svaghetskänsla' },
    { id: 'mentalTired', label: 'Mental trötthet eller koncentrationssvårigheter' },
  ]},
  { title: 'Sömn och känsloliv', items: [
    { id: 'sleepStart', label: 'Svårt att somna' },
    { id: 'wakeNight', label: 'Vaknar ofta under natten' },
    { id: 'rumination', label: 'Grubblar mycket eller har svårt att varva ner' },
    { id: 'palpitations', label: 'Upplever hjärtklappning' },
    { id: 'irritable', label: 'Blir lätt irriterad eller frustrerad' },
    { id: 'costal', label: 'Spänd eller tryckande känsla under revbensbågen' },
  ]},
  { title: 'Värme, kyla och vätskor', items: [
    { id: 'coldWorse', label: 'Besvär blir tydligt värre av kyla' },
    { id: 'hotPalms', label: 'Varm i handflator eller fotsulor, särskilt kvällstid' },
    { id: 'nightSweats', label: 'Svettas nattetid' },
    { id: 'dryMouth', label: 'Muntorrhet, särskilt kvällstid' },
    { id: 'legHeavy', label: 'Tunghetskänsla i benen' },
    { id: 'tinnitus', label: 'Återkommande öronsusningar' },
  ]},
  { title: 'Muskler, leder och övrigt', items: [
    { id: 'jointChronic', label: 'Långvarig värk eller stelhet i lederna' },
    { id: 'betterWarm', label: 'Ledvärk lindras av värme' },
    { id: 'backWeak', label: 'Svaghet eller dov värk i ländrygg och knän' },
    { id: 'hotJoint', label: 'Led som blir röd, varm eller svullen' },
    { id: 'urineBurn', label: 'Sveda eller täta trängningar vid urinering' },
    { id: 'menstrual', label: 'Humör eller fysiska symtom ändras vid menstruation' },
    { id: 'scantMenses', label: 'Sparsam menstruation' },
  ]},
] as const;
export type Symptom = (typeof symptomGroups)[number]['items'][number]['id'];

export type Choice = 'yes' | 'no' | '';
export type Heat = 'cold' | 'warm' | 'neutral' | 'unsure' | '';
export type Tongue = 'pale' | 'red' | 'greasy' | 'normal' | 'unsure' | '';
export type Duration = 'days' | 'weeks' | 'months' | 'years' | 'unsure' | '';

export interface Intake {
  adult: Choice;
  pregnantOrNursing: Choice;
  emergency: Choice;
  meds: boolean;
  chronic: boolean;
  allergies: boolean;
  focus: Focus | '';
  symptoms: Symptom[];
  heat: Heat;
  tongue: Tongue;
  duration: Duration;
}

export const initialIntake: Intake = {
  adult: '', pregnantOrNursing: '', emergency: '',
  meds: false, chronic: false, allergies: false,
  focus: '', symptoms: [], heat: '', tongue: '', duration: '',
};

export interface Pattern {
  id: string;
  name: string;
  hanzi: string;
  formula: string;
  context: string;
  differentials: string;
  focuses: readonly Focus[];
  weights: Partial<Record<Symptom, number>>;
}

// Mönster och historiska formula-referenser är utgångspunkter för vidare anamnes;
// dessa motsvarar INTE säkra eller legalt klassificerade produkter i Sverige.
export const patterns: readonly Pattern[] = [
  { id: 'xys', name: 'Lever-Qi-stagnation med Mjälte-Qi-brist', hanzi: '肝郁脾虚', formula: 'Xiao Yao San',
    context: 'Stagnation som påverkar matsmältning och emotionellt välbefinnande.',
    differentials: 'Kontrollera om Blodbrist verkligen finns; skilj från Lever-Eld och Mag-Hetta.',
    focuses: ['stress','digestion'], weights: { stressGut: 4, costal: 4, irritable: 2, lowAppetite: 1, afterMealBloat: 1, menstrual: 3, rumination: 1 } },
  { id: 'xslj', name: 'Mjälte-Qi-brist med Fukt och Mag-Qi-stagnation', hanzi: '脾虚湿困', formula: 'Xiang Sha Liu Jun Zi Tang',
    context: 'Brist och Fukt med måltidsrelaterad fullhet.',
    differentials: 'Skilj från Mag-Yin-brist, födostagnation och Fukt-Hetta.',
    focuses: ['digestion'], weights: { afterMealBloat: 4, lowAppetite: 3, looseStool: 3, nausea: 4, lowEnergy: 1, coldWorse: 2 } },
  { id: 'bzyq', name: 'Mjälte-Qi-brist med sjunkande Qi', hanzi: '中气下陷', formula: 'Bu Zhong Yi Qi Tang',
    context: 'Bristmönster där Qi:s lyftande funktion kan vara påverkad.',
    differentials: 'Bekräfta tecken på sjunkande Qi, inte enbart trötthet.',
    focuses: ['energy','digestion'], weights: { lowEnergy: 3, weakVoice: 3, lowAppetite: 2, looseStool: 1, sinking: 5, spontSweat: 1 } },
  { id: 'szrt', name: 'Lever-Blodbrist med störd Shen och möjlig bristhetta', hanzi: '肝血不足，虚热扰神', formula: 'Suan Zao Ren Tang',
    context: 'En bristpräglad sömnstörning med rastlöshet.',
    differentials: 'Skilj från Lever-Eld, Slem-Hetta och Hjärt-Mjälte-brist.',
    focuses: ['sleep'], weights: { sleepStart: 3, wakeNight: 3, nightSweats: 2, hotPalms: 2, dryMouth: 1, irritable: 1 } },
  { id: 'ypfs', name: 'Lung-/Wei Qi-brist', hanzi: '卫气不固', formula: 'Yu Ping Feng San',
    context: 'Svag ytlig försvarsfunktion i klassisk TCM-teori.',
    differentials: 'Skilj konstitutionell brist från aktiv infektion eller feber.',
    focuses: ['immunity','energy'], weights: { frequentSick: 5, spontSweat: 5, weakVoice: 1, lowEnergy: 1, coldWorse: 1 } },
  { id: 'gpt', name: 'Hjärt-Blodbrist med Mjälte-Qi-brist', hanzi: '心脾两虚', formula: 'Gui Pi Tang',
    context: 'Samtidig mental trötthet och Shen-oro med Qi-brist.',
    differentials: 'Uteslut medicinsk orsak till hjärtklappning och blodbristtecken.',
    focuses: ['sleep','energy'], weights: { rumination: 4, mentalTired: 3, palpitations: 3, sleepStart: 2, lowEnergy: 2, lowAppetite: 1, pale: 1 } },
  { id: 'bzt', name: 'Kombinerad Qi- och Blodbrist', hanzi: '气血两虚', formula: 'Ba Zhen Tang',
    context: 'Bristtecken som kan omfatta energi och Blod enligt TCM.',
    differentials: 'Blekhet, yrsel och trötthet bör även bedömas medicinskt.',
    focuses: ['energy'], weights: { pale: 4, dizzy: 3, lowEnergy: 3, scantMenses: 4, palpitations: 2, weakVoice: 1 } },
  { id: 'dhjst', name: 'Vind-Kyla-Fukt-Bi med underliggande brist', hanzi: '风寒湿痹，肝肾不足', formula: 'Du Huo Ji Sheng Tang',
    context: 'Kroniskt kallt/stelt Bi-mönster med bristkomponent.',
    differentials: 'Skilj från akuta inflammatoriska och neurologiska orsaker.',
    focuses: ['joints'], weights: { jointChronic: 4, coldWorse: 3, betterWarm: 4, backWeak: 3, legHeavy: 1 } },
  { id: 'sms', name: 'Fukt-Hetta i nedre Jiao', hanzi: '下焦湿热', formula: 'Si Miao San',
    context: 'Värme tillsammans med Fukt- och tyngdtecken.',
    differentials: 'Varm/svullen led eller urinvägsbesvär kan kräva medicinsk bedömning.',
    focuses: ['joints','heat'], weights: { hotJoint: 5, legHeavy: 3, urineBurn: 5, hotPalms: 1 } },
  { id: 'lwdh', name: 'Lever-/Njure-Yin-brist', hanzi: '肝肾阴虚', formula: 'Liu Wei Di Huang Wan',
    context: 'Torrhet, värmekänsla och andra tecken på Yin-brist.',
    differentials: 'Skilj från full Hetta och andra orsaker till nattliga svettningar.',
    focuses: ['heat','sleep'], weights: { nightSweats: 4, hotPalms: 4, dryMouth: 4, backWeak: 2, tinnitus: 4, wakeNight: 1 } },
];

const symptomOptions = symptomGroups.flatMap(group => group.items.map(item => ({ id: item.id, label: item.label })));
const labels = new Map<string, string>(symptomOptions.map(item => [item.id, item.label]));
const knownSymptoms = new Set<string>(labels.keys());
const knownFocuses = new Set<string>(focusOptions.map(option => option.id));
const choices = new Set<string>(['yes', 'no', '']);
const heatLabels: Record<Heat, string> = {
  '': 'Ej angivet', cold: 'Ofta frusen', warm: 'Ofta varm', neutral: 'Varken eller', unsure: 'Vet inte',
};
const tongueLabels: Record<Tongue, string> = {
  '': 'Ej angivet', pale: 'Blek', red: 'Röd', greasy: 'Tjock eller kladdig beläggning', normal: 'Ingen tydlig avvikelse', unsure: 'Vet inte',
};
const durationLabels: Record<Duration, string> = {
  '': 'Ej angivet', days: 'Dagar', weeks: 'Veckor', months: 'Månader', years: 'År', unsure: 'Vet inte',
};

export const symptomLabel = (id: Symptom) => labels.get(id) ?? 'Okänt symtom';
export const focusLabel = (id: Focus | '') => focusOptions.find(option => option.id === id)?.label ?? 'Ej valt';

export interface PatternMatch extends Pattern { points: number; matched: Symptom[] }
export interface Analysis {
  status: 'incomplete' | 'emergency' | 'ready';
  matches: PatternMatch[];
  /** Originalets poängtröskel är en regelbaserad heuristik, inte klinisk säkerhet eller sannolikhet. */
  confident: boolean;
  clinicalCaution: boolean;
  higherRisk: boolean;
  canShowFormulaReferences: boolean;
}

function readIntake(input: unknown) {
  const record = input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const read = (key: keyof Intake): unknown => Object.hasOwn(record, key) ? record[key] : undefined;
  let valid = true;
  function choice(key: 'adult' | 'pregnantOrNursing' | 'emergency'): Choice {
    const value = read(key);
    if (typeof value !== 'string' || !choices.has(value) || !value) {
      valid = false;
      return '';
    }
    return value as Choice;
  }
  function flag(key: 'meds' | 'chronic' | 'allergies'): boolean {
    const value = read(key);
    if (typeof value !== 'boolean') valid = false;
    return value === true;
  }
  function optionalChoice<T extends string>(key: 'heat' | 'tongue' | 'duration', options: Record<T, string>): T {
    const value = read(key) ?? '';
    // Missing optional observations are allowed; other runtime values must be known choices.
    if (typeof value !== 'string' || !Object.hasOwn(options, value) || read(key) === null) {
      valid = false;
      return '' as T;
    }
    return value as T;
  }
  const rawSymptoms = read('symptoms');
  const symptomsAreValid = Array.isArray(rawSymptoms)
    && Array.from(rawSymptoms).every(value => typeof value === 'string' && knownSymptoms.has(value));
  if (!symptomsAreValid || rawSymptoms.length === 0) valid = false;
  const selected = new Set(Array.isArray(rawSymptoms) ? rawSymptoms.filter(value => typeof value === 'string' && knownSymptoms.has(value)) : []);
  // Canonical order also makes duplicate and reordered inputs produce the same summary.
  const symptoms = symptomOptions.filter(option => selected.has(option.id)).map(option => option.id);
  const rawFocus = read('focus');
  const focus = typeof rawFocus === 'string' && knownFocuses.has(rawFocus) ? rawFocus as Focus : '';
  if (!focus) valid = false;
  const intake: Intake = {
    adult: choice('adult'),
    pregnantOrNursing: choice('pregnantOrNursing'),
    emergency: choice('emergency'),
    meds: flag('meds'), chronic: flag('chronic'), allergies: flag('allergies'),
    focus, symptoms,
    heat: optionalChoice('heat', heatLabels),
    tongue: optionalChoice('tongue', tongueLabels),
    duration: optionalChoice('duration', durationLabels),
  };
  return { intake, valid, read };
}

function analyseParsedIntake({ intake, valid }: ReturnType<typeof readIntake>): Analysis {
  const higherRisk = intake.adult === 'no' || intake.pregnantOrNursing === 'yes' || intake.meds || intake.chronic || intake.allergies;
  const clinicalCaution = ['hotJoint', 'urineBurn', 'palpitations', 'dizzy'].some(symptom => intake.symptoms.includes(symptom as Symptom));
  const status = intake.emergency === 'yes' ? 'emergency' : valid ? 'ready' : 'incomplete';
  if (status !== 'ready') return { status, matches: [], confident: false, clinicalCaution, higherRisk, canShowFormulaReferences: false };

  const results = patterns.map((pattern, order) => {
    const matched = intake.symptoms.filter(symptom => Object.hasOwn(pattern.weights, symptom));
    let points = matched.reduce((total, symptom) => total + (pattern.weights[symptom] ?? 0), 0);
    if (intake.focus && pattern.focuses.includes(intake.focus)) points += 2;
    if (intake.heat === 'cold' && ['dhjst', 'xslj', 'bzyq'].includes(pattern.id)) points += 2;
    if (intake.heat === 'warm' && ['sms', 'lwdh', 'szrt'].includes(pattern.id)) points += 1;
    if (intake.tongue === 'pale' && ['bzt', 'bzyq', 'gpt', 'xslj'].includes(pattern.id)) points += 2;
    if (intake.tongue === 'red' && ['lwdh', 'sms', 'szrt'].includes(pattern.id)) points += 1;
    if (intake.tongue === 'greasy' && ['sms', 'xslj'].includes(pattern.id)) points += 2;
    return { ...pattern, points, matched, order };
  }).sort((a, b) => b.points - a.points || a.order - b.order);
  const best = results[0];
  const confident = intake.symptoms.length >= 3 && best.points >= 7 && best.matched.length >= 2;
  const matches = confident ? results.filter((result, index) => index === 0 || (
    index === 1 && result.points >= 6 && best.points - result.points <= 3 && result.matched.length >= 2
  )).slice(0, 2).map(({ order: _order, ...match }) => match) : [];
  return { status, matches, confident, clinicalCaution, higherRisk, canShowFormulaReferences: confident && !higherRisk && !clinicalCaution };
}

/** Pure calculation: reads no browser storage and sends no intake data. */
export function analyseIntake(input: unknown): Analysis {
  return analyseParsedIntake(readIntake(input));
}

/** Recalculate from the supplied answers so a stale or altered Analysis cannot bypass the safety gate. */
export function makeSummary(input: unknown, _analysis?: Analysis): string {
  const parsed = readIntake(input);
  const { intake, read } = parsed;
  const analysis = analyseParsedIntake(parsed);
  const choiceAnswer = (value: unknown) => value === 'yes' ? 'Ja' : value === 'no' ? 'Nej' : 'Ej besvarat';
  const flagAnswer = (value: unknown) => value === true ? 'Ja' : value === false ? 'Nej' : 'Ej besvarat';
  const lines = [
    'FÖRBEREDANDE ANAMNES – ATT TA MED TILL KONSULTATION',
    '',
    `18 år eller äldre: ${choiceAnswer(read('adult'))}`,
    `Gravid eller ammar: ${choiceAnswer(read('pregnantOrNursing'))}`,
    `Akuta allvarliga symtom: ${choiceAnswer(read('emergency'))}`,
    `Regelbundna läkemedel eller kosttillskott: ${flagAnswer(read('meds'))}`,
    `Långvarig sjukdom eller medicinsk behandling: ${flagAnswer(read('chronic'))}`,
    `Allergier eller reaktion på örtpreparat: ${flagAnswer(read('allergies'))}`,
    `Huvudområde: ${focusLabel(intake.focus)}`,
    `Symtom: ${intake.symptoms.map(symptomLabel).join('; ') || 'Inga markerade'}`,
    `Temperatur: ${heatLabels[intake.heat]}`,
    `Tunga: ${tongueLabels[intake.tongue]}`,
    `Varaktighet: ${durationLabels[intake.duration]}`,
  ];
  if (analysis.status === 'emergency') {
    lines.push('', 'Självskattningen avbröts på grund av markerade akuta allvarliga symtom. Sök vård omedelbart och ring 112 vid nödläge.');
  } else if (analysis.status === 'incomplete') {
    lines.push('', 'Ofullständiga eller ogiltiga svar. Ingen mönsterbedömning har gjorts.');
  } else {
    lines.push(
      `Särskild säkerhetsbedömning behövs: ${analysis.higherRisk ? 'Ja' : 'Inga sådana uppgifter markerade'}`,
      `Ytterligare medicinsk bedömning kan behövas: ${analysis.clinicalCaution ? 'Ja' : 'Ej flaggat'}`,
      `TCM-mönsterhypoteser: ${analysis.matches.map(match => match.name).join(' / ') || 'Otillräckligt underlag'}`,
    );
    if (analysis.canShowFormulaReferences) {
      lines.push(`Klassiska formelreferenser att jämföra med terapeut: ${analysis.matches.map(match => match.formula).join(' / ')}`);
      lines.push('Formelreferenserna är endast referenser i TCM-litteraturen, inte behandlings-, inköps- eller doseringsråd.');
    }
  }
  lines.push('', 'Detta är en självskattning – inte medicinsk diagnos eller ordination.');
  return lines.join('\n');
}
