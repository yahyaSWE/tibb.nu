import { patternCatalog } from '../patterns';
import { questionBank, isPublicQuestion } from '../questions';
import type { EvidenceRule, PatternId, QuestionId } from '../types';

export const labVersion = 'differential-lab-2026-10-v1';
export const labBook = {
  title: 'The Practice of Chinese Medicine', edition: 3, year: '2021/2022', isbn: '9780702079207',
  url: 'https://evolve.elsevier.com/cs/product/9780702079207?role=student',
  status: 'Fulltext och sidbundna diagnoskriterier är inte granskade. Profilerna är inte verifierade mot boken.',
};
export const labSources = [
  { id: 'who', title: 'WHO: TCM-terminologi (2022), avsnitt 2.3–2.4', url: 'https://www.who.int/publications/i/item/9789240042322', role: 'Terminologi och mönsterfamiljer; ingen validering av denna motor.' },
  { id: 'blood', title: 'Giovanni Maciocia: On Blood Deficiency', url: 'https://giovanni-maciocia.com/wp-content/uploads/2019/02/EJOM_Blood_Deficiency.pdf', role: 'Originalartikel om Blodbrist, skild från den valda bokens tredje upplaga.' },
  { id: 'methods', title: 'Hong Kong Department of Health: diagnostiska metoder', url: 'https://www.cmro.gov.hk/html/eng/useful_information/public_health/pamphlet/Diagnostic_Methods_and_Features_of_CMP.html', role: 'Fyra undersökningsmetoder; ett webbformulär kan inte genomföra alla.' },
  { id: 'hair', title: '1177: Håravfall', url: 'https://www.1177.se/haravfall', role: 'Håravfallets förlopp, medicinska alternativ och bedömningsbehov.' },
];
export type LabRule = { topic: string; values: string[]; weight: number };
export type LabTopic = { id: string; prompt: string; options: { value: string; label: string }[]; legacyId: QuestionId | null };
const unsure = [{ value: 'unknown', label: 'Vet inte' }, { value: 'prefer_not', label: 'Vill inte svara' }];
const topic = (id: string, prompt: string, options: [string, string][] = []): LabTopic => ({ id, prompt, legacyId: null,
  options: [...(options.length ? options.map(([value, label]) => ({ value, label })) : [{ value: 'yes', label: 'Ja' }, { value: 'no', label: 'Nej' }]), ...unsure] });
export const labTopics: LabTopic[] = [
  ...questionBank.filter(isPublicQuestion).map(q => ({ id: q.id, prompt: q.prompt, options: q.options, legacyId: q.id })),
  topic('hairDistribution', 'Hur ser håravfallet främst ut?', [['diffuse', 'Tunnare eller mer håravfall över större delen av huvudet'], ['patches', 'Tydligt avgränsade kala fläckar'], ['hairline', 'Främst hårfäste, tinningar eller hjässa'], ['breakage', 'Håret går främst av'], ['other', 'Annat eller svårt att beskriva']]),
  topic('scalpCondition', 'Har du klåda, fjällning, rodnad eller ömhet i hårbotten?', [['inflamed', 'Rodnad eller ömhet'], ['oily_flaky', 'Fet hårbotten med klåda eller fjällning'], ['dry_flaky', 'Torr hårbotten med klåda eller fjällning'], ['normal', 'Inga sådana besvär']]),
  topic('hairTrigger', 'Började håravfallet efter någon tydlig förändring?', [['illness', 'Efter sjukdom'], ['birth', 'Efter förlossning'], ['stress', 'Efter en belastande period'], ['diet_weight', 'Efter ändrad kost eller viktnedgång'], ['medication', 'Efter ett nytt eller ändrat läkemedel'], ['none', 'Ingen tydlig förändring']]),
  topic('hairFamily', 'Finns ett liknande mönster av håravfall i din familj?'),
  topic('hairRegrowth', 'Har du märkt återväxt där du har tappat hår?'),
  topic('earlyGrey', 'Har du upplevt tydligt tidigt grånande jämfört med din familj?'),
  topic('memoryChange', 'Har du långvarigt märkt försämrat minne eller koncentration?'),
  topic('teethWeakness', 'Har du problem med lösa tänder som har bedömts av tandvården?'),
  topic('reproductiveChange', 'Finns en långvarig förändring av reproduktiv funktion som du vill ta upp?'),
  topic('numbnessCramps', 'Har du återkommande domningar, stickningar eller muskelkramper?'),
  topic('nightUrination', 'Behöver du återkommande gå upp flera gånger på natten för att urinera?'),
  topic('urineLeakage', 'Har du återkommande urinläckage eller efterdropp?'),
  topic('morningDiarrhea', 'Har du återkommande lös avföring tidigt på morgonen?'),
  topic('coldLimbs', 'Är händer eller fötter ofta tydligt kalla?'),
  topic('warmthRelief', 'Lindras de aktuella besvären av värme?'),
  topic('pressureRelief', 'Lindras de aktuella besvären av lätt tryck?'),
  topic('hungerPain', 'Kommer magbesvären när magen är tom och lindras av lite mat?'),
  topic('bitterTaste', 'Har du återkommande bitter smak i munnen?'),
  topic('stickyMouth', 'Har du ofta en kladdig känsla i munnen?'),
  topic('bleedingTendency', 'Har du återkommande oförklarliga blödningar som behöver tas upp?'),
  topic('drySkin', 'Har du långvarigt torr hud utan tydlig lokal förklaring?'),
  topic('lowGradeWarmth', 'Känner du återkommande lätt värme utan tydliga svettningar eller törst?'),
  topic('voiceHoarse', 'Har du långvarig heshet eller torr röst?'),
  topic('headPressure', 'Känns huvudet tungt eller grumligt?'),
  topic('headStress', 'Ökar huvudbesvären tydligt vid känslomässig belastning?'),
  topic('chestOppression', 'Har du en återkommande tryckande känsla över bröstet som behöver förtydligas?'),
  topic('alternatingChillsHeat', 'Växlar du tydligt mellan frossa och värmekänsla?'),
  topic('jointMigration', 'Flyttar ledvärken mellan olika leder?'),
  topic('jointFixed', 'Sitter ledvärken oftast kvar i samma område?'),
  topic('symptomLocation', 'Var sitter huvudbesvären främst? Beskriv gärna mer i kompletteringen.', [['head','Huvud, ansikte eller hårbotten'],['chest','Bröst eller andning'],['abdomen','Mage eller buk'],['back_joints','Rygg, muskler eller leder'],['general','Hela kroppen eller flera områden'],['other','Annat område']]),
];
export const labTopicById = new Map(labTopics.map(q => [q.id, q]));
const r = (topic: string, values: string | string[] = 'yes', weight = 3): LabRule => ({ topic, values: Array.isArray(values) ? values : [values], weight });
const adapt = (rule: EvidenceRule): LabRule => r(rule.questionId, rule.values, rule.weight);
export type LabPattern = { id: string; name: string; family: string; legacyId: PatternId | null; support: LabRule[]; oppose: LabRule[]; core: LabRule[]; groups: LabRule[][]; sources: string[]; examination: string[]; bookVerified: false };
function p(id: string, name: string, family: string, support: LabRule[], oppose: LabRule[], core: LabRule[] = [], groups: LabRule[][] = []): LabPattern {
  return { id, name, family, legacyId: null, support, oppose, core, groups, sources: ['who'], examination: ['Tung- och pulsundersökning samt självständig bedömning'], bookVerified: false };
}
export const labPatterns: LabPattern[] = [
  ...patternCatalog.map(pattern => ({ id: pattern.id, name: pattern.name, family: pattern.zangFu.join(' / '), legacyId: pattern.id,
    support: pattern.supportingRules.map(adapt), oppose: pattern.opposingRules.map(adapt), core: pattern.coreRules.map(adapt), groups: pattern.requiredEvidenceGroups.map(g => g.map(adapt)),
    sources: ['liverBloodDeficiency', 'heartBloodDeficiency', 'qiBloodDeficiency'].includes(pattern.id) ? ['blood'] : ['existing'],
    examination: ['Behandlarens undersökning och oberoende mönsterbedömning'], bookVerified: false as const })),
  p('kidneyEssenceDeficiency', 'Njure-Jing-/essensbrist', 'Njure / Jing', [r('earlyGrey'), r('memoryChange'), r('tinnitus'), r('teethWeakness'), r('reproductiveChange'), r('backWeakness')], [r('duration', 'days', 4)], [], [[r('earlyGrey'), r('teethWeakness'), r('reproductiveChange')], [r('memoryChange'), r('tinnitus'), r('backWeakness')]]),
  p('kidneyYangDeficiency', 'Njure-Yang-brist', 'Njure / Yang', [r('temperature', 'cold', 4), r('coldLimbs'), r('backWeakness'), r('nightUrination'), r('urination', 'frequent_clear'), r('energy', 'low'), r('morningDiarrhea')], [r('hotPalms', 'yes', 4), r('nightSweats', 'yes', 4)], [r('temperature', 'cold')], [[r('backWeakness'), r('nightUrination'), r('urination', 'frequent_clear')]]),
  p('kidneyQiDeficiency', 'Njure-Qi-brist med bristande fasthet', 'Njure / Qi', [r('urineLeakage', 'yes', 4), r('nightUrination'), r('backWeakness'), r('energy', 'low'), r('weakVoice')], [r('urination', 'burning', 5)], [r('urineLeakage')]),
  p('liverYinDeficiency', 'Lever-Yin-brist', 'Lever / Yin', [r('dryEyes'), r('dryMouth'), r('dizziness'), r('drySkin'), r('tongueCoating', 'scant'), r('numbnessCramps')], [r('tongueCoating', 'yellow_greasy', 4)], [], [[r('dryEyes')], [r('dryMouth'), r('tongueCoating', 'scant')]]),
  p('liverYangRising', 'Uppåtstigande Lever-Yang', 'Lever / Yang', [r('dizziness'), r('tinnitus'), r('headStress'), r('irritability'), r('dryEyes'), r('tongueColor', 'red')], [r('pallor', 'yes', 4)], [r('headStress')]),
  p('heartQiDeficiency', 'Hjärt-Qi-brist', 'Hjärta / Qi', [r('palpitations', 'yes', 4), r('energy', 'low'), r('weakVoice'), r('sweating', 'spontaneous'), r('exertion', 'tired')], [r('temperature', 'hot', 4)], [r('palpitations')], [[r('weakVoice'), r('exertion', 'tired')]]),
  p('heartYinDeficiency', 'Hjärt-Yin-brist', 'Hjärta / Yin', [r('palpitations'), r('nightWaking'), r('dryMouth'), r('nightSweats'), r('hotPalms'), r('tongueColor', 'red')], [r('temperature', 'cold', 4)], [r('palpitations')], [[r('nightSweats'), r('hotPalms')]]),
  p('lungYinDeficiency', 'Lung-Yin-brist', 'Lunga / Yin', [r('cough', 'dry', 4), r('dryMouth'), r('voiceHoarse'), r('nightSweats'), r('tongueCoating', 'scant')], [r('phlegm', 'yellow', 4)], [r('cough', 'dry')], [[r('dryMouth'), r('tongueCoating', 'scant')]]),
  p('lungQiDeficiency', 'Lung-Qi-brist', 'Lunga / Qi', [r('weakVoice', 'yes', 4), r('energy', 'low'), r('sweating', 'spontaneous'), r('exertion', 'tired'), r('frequentInfections')], [r('temperature', 'hot', 4)], [r('weakVoice')]),
  p('stomachColdDeficiency', 'Magbrist med Kyla', 'Mage / Kyla', [r('hungerPain', 'yes', 4), r('warmthRelief'), r('pressureRelief'), r('appetite', 'low'), r('temperature', 'cold')], [r('abdominalPain', 'burning', 4)], [r('hungerPain')], [[r('warmthRelief')]]),
  p('stomachFire', 'Mag-Eld', 'Mage / Hetta', [r('abdominalPain', 'burning'), r('appetite', 'high'), r('thirst', 'strong_cold'), r('constipation'), r('tongueCoating', 'yellow_dry')], [r('temperature', 'cold', 5)], [r('thirst', 'strong_cold')], [[r('appetite', 'high'), r('tongueCoating', 'yellow_dry')]]),
  p('spleenKidneyYangDeficiency', 'Mjälte-/Njure-Yang-brist', 'Mjälte / Njure', [r('temperature', 'cold', 4), r('morningDiarrhea', 'yes', 4), r('backWeakness'), r('energy', 'low'), r('edema'), r('stool', 'loose')], [r('temperature', 'hot', 5)], [r('temperature', 'cold'), r('morningDiarrhea')]),
  p('phlegmDamp', 'Slem-Fukt', 'Slem / Fukt', [r('heaviness'), r('headPressure'), r('phlegm', 'clear'), r('tongueCoating', 'white_greasy'), r('nausea')], [r('tongueCoating', 'scant', 4)], [], [[r('phlegm', 'clear'), r('tongueCoating', 'white_greasy')]]),
  p('gallbladderDampHeat', 'Fukt-Hetta i Lever/Gallblåsa', 'Lever / Gallblåsa', [r('bitterTaste'), r('ribTension'), r('nausea'), r('tongueCoating', 'yellow_greasy'), r('urination', 'scant_dark')], [r('temperature', 'cold', 4)], [r('bitterTaste')], [[r('tongueCoating', 'yellow_greasy')]]),
  p('bloodHeat', 'Blod-Hetta', 'Blod / Hetta', [r('temperature', 'hot'), r('thirst', 'strong_cold'), r('tongueColor', 'red'), r('bleedingTendency'), r('drySkin')], [r('temperature', 'cold', 5)], [r('temperature', 'hot')], [[r('bleedingTendency'), r('tongueColor', 'red')]]),
  p('scalpDampHeat', 'Fukt-Hetta med hårbottenbesvär', 'Hud / Fukt-Hetta', [r('scalpCondition', 'oily_flaky', 4), r('stickyMouth'), r('heaviness'), r('tongueCoating', 'yellow_greasy'), r('temperature', 'hot')], [r('scalpCondition', 'normal', 5)], [r('scalpCondition', 'oily_flaky')], [[r('tongueCoating', 'yellow_greasy'), r('temperature', 'hot')]]),
  p('windColdExterior', 'Yttre Vind-Kyla', 'Yttre / Kyla', [r('duration', 'days'), r('onset', 'sudden'), r('windSensitivity'), r('temperature', 'cold'), r('phlegm', 'clear')], [r('duration', 'years', 5), r('thirst', 'strong_cold', 4)], [r('duration', 'days'), r('temperature', 'cold')]),
  p('shaoyangDisharmony', 'Shaoyang-disharmoni', 'Sex stadier', [r('alternatingChillsHeat', 'yes', 4), r('bitterTaste'), r('ribTension'), r('nausea'), r('appetite', 'low')], [r('alternatingChillsHeat', 'no', 5)], [r('alternatingChillsHeat')]),
];
export const labPatternById = new Map(labPatterns.map(p => [p.id, p]));
// Research scope is explicit. Unimplemented families must never be presented as covered.
export const labCoverage = [
  ['Åtta principer', 'Delvis: Kyla/Hetta, brist/överskott och inre/yttre via profiler'],
  ['Qi, Blod, Yin, Yang, Jing och vätskor', 'Testprofiler; Jing är separat från Yin'],
  ['Zang-Fu och blandbilder', 'Utvalda profiler; inte alla kombinationer'],
  ['Sex stadier', 'Endast Shaoyang och utvalda yttre mönster'],
  ['Fyra nivåer och tre Jiao', 'Ofullständigt; ingen fullständig progression eller akutdiagnostik'],
  ['Meridianer och extraordinära kärl', 'Inte fullständigt implementerat'],
  ['Maciocia, tredje upplagan', 'Bibliografi verifierad; kapitel- och sidkriterier återstår att granska'],
];
