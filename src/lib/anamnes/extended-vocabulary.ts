import type { Question } from './types';

export const extraQuestionIds=["hairDistribution","scalpCondition","hairTrigger","hairFamily","hairRegrowth","earlyGrey","memoryChange","teethWeakness","reproductiveChange","numbnessCramps","nightUrination","urineLeakage","morningDiarrhea","coldLimbs","warmthRelief","pressureRelief","hungerPain","bitterTaste","stickyMouth","bleedingTendency","drySkin","lowGradeWarmth","voiceHoarse","headPressure","headStress","chestOppression","alternatingChillsHeat","jointMigration","jointFixed","symptomLocation"] as const;
export const extraPatternIds=["kidneyEssenceDeficiency","kidneyYangDeficiency","kidneyQiDeficiency","liverYinDeficiency","liverYangRising","heartQiDeficiency","heartYinDeficiency","lungYinDeficiency","lungQiDeficiency","stomachColdDeficiency","stomachFire","spleenKidneyYangDeficiency","phlegmDamp","gallbladderDampHeat","bloodHeat","scalpDampHeat","windColdExterior","shaoyangDisharmony"] as const;
const unsure=[{value:'unknown',label:'Vet inte'},{value:'prefer_not',label:'Vill inte svara'}];
function topic(id:typeof extraQuestionIds[number],prompt:string,options:[string,string][]=[]):Question {
  return {id,section:'Fördjupning',prompt,professionalOnly:false,options:[...(options.length?options.map(([value,label])=>({value,label})):[{value:'yes',label:'Ja'},{value:'no',label:'Nej'}]),...unsure]};
}
export const extraQuestions:Question[]=[
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
