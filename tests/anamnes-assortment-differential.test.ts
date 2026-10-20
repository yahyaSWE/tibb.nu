import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzePatterns, buildReport } from '../src/lib/anamnes/engine';
import { formulaSeed } from '../src/lib/anamnes/catalog-seed';
import { getFormulaComparisonQuestionIds, getIndependentDifferentialQuestionIds, getInterviewCompletionQuestionIds, sanitizeInterviewQuestionIds } from '../src/lib/anamnes/interview';
import { patternCatalog, rule } from '../src/lib/anamnes/patterns';
import { isPublicQuestion, questionBank, validateAnswers } from '../src/lib/anamnes/questions';
import { explainAnamnesReport } from '../src/lib/anamnes/report-explanation';
import { ReportSchema, type AnswerMap, type PatternId } from '../src/lib/anamnes/types';

// Entirely fictional structured cases. These check implementation constraints,
// not clinical accuracy or whether a product would be appropriate to use.
const base: AnswerMap = {
  adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no',
  focus:'other',duration:'months',onset:'gradual',trend:'stable',temperature:'neutral',thirst:'normal',sweating:'normal',energy:'normal',appetite:'normal',stool:'normal',sleep:'normal',emotion:'calm',pain:'no',
};
const fixture = (overrides: AnswerMap): AnswerMap => ({...base,...overrides});
const qualified = (answers: AnswerMap, id: PatternId) => analyzePatterns(answers).patterns.some(finding => finding.id === id && finding.qualified);

test('A: digestive weakness/dampness does not imply cold or Qi stagnation', () => {
  const damp = fixture({focus:'digestion',energy:'after_food',appetite:'low',stool:'loose',heaviness:'yes',afterMealBloat:'yes',tongueCoating:'white_greasy',reflux:'none',abdominalPain:'none'});
  assert.equal(qualified(damp,'spleenDampness'),true);
  assert.equal(qualified(damp,'spleenQiColdDampStagnation'),false);
  assert.equal(qualified({...damp,temperature:'cold'},'spleenQiColdDampStagnation'),false,'cold cannot replace the independent stagnation component');
  const coldStagnation = {...damp,temperature:'cold',reflux:'belching',abdominalPain:'distending',nausea:'yes',pain:'yes'};
  assert.equal(qualified(coldStagnation,'spleenQiColdDampStagnation'),true);
  assert.equal(qualified({...coldStagnation,energy:'normal',weakVoice:'no'},'spleenQiColdDampStagnation'),false);
  assert.equal(qualified({...coldStagnation,temperature:'hot',tongueCoating:'yellow_greasy'},'spleenQiColdDampStagnation'),false);
});

test('B: combined Qi/Blood deficiency is separate from its cold/Yang component', () => {
  const qiBlood = fixture({focus:'energy',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired'});
  assert.equal(qualified(qiBlood,'qiBloodDeficiency'),true);
  assert.equal(qualified(qiBlood,'qiBloodYangDeficiency'),false);
  assert.equal(qualified({...qiBlood,temperature:'cold'},'qiBloodYangDeficiency'),true);
  for (const temperature of ['unknown','prefer_not','hot','neutral']) assert.equal(qualified({...qiBlood,temperature},'qiBloodYangDeficiency'),false);
  const fatigueOnly = {...qiBlood,temperature:'cold',pallor:'no',tongueColor:'normal',menstrualFlow:'normal'};
  assert.equal(qualified(fatigueOnly,'qiBloodYangDeficiency'),false,'cold fatigue is not confirmed Blood deficiency');
});

test('C: stress and Qi stagnation cannot substitute for stasis or heat', () => {
  const stagnation = fixture({focus:'stress',ribTension:'yes',stressDigestion:'yes',stressRelief:'yes',irritability:'yes',emotion:'irritable',pain:'yes',painCharacter:'distending'});
  assert.equal(qualified(stagnation,'liverQiStagnation'),true);
  assert.equal(qualified(stagnation,'liverQiStasisHeat'),false);
  const combined = {...stagnation,painCharacter:'stabbing',tongueColor:'purple',temperature:'hot'};
  assert.equal(qualified(combined,'liverQiStasisHeat'),true);
  assert.equal(qualified({...combined,temperature:'neutral',tongueCoating:'normal',thirst:'normal'},'liverQiStasisHeat'),false);
  assert.equal(qualified({...combined,painCharacter:'distending',tongueColor:'normal',abdominalPain:'none',menstrualPain:'none'},'liverQiStasisHeat'),false);
});

test('D: lower-body cold/Yang, dry/Yin and damp-heat are independent profiles', () => {
  const yang = fixture({focus:'pain',pain:'yes',painLocation:'back_knees',temperature:'cold',backWeakness:'yes',weatherPain:'yes',painWarmth:'better',stiffness:'yes',energy:'low',jointWarmth:'no'});
  assert.equal(qualified(yang,'kidneyYangColdDampBi'),true);
  assert.equal(qualified({...yang,temperature:'neutral'},'kidneyYangColdDampBi'),false);
  assert.equal(qualified({...yang,backWeakness:'no'},'kidneyYangColdDampBi'),false);
  const yin = fixture({focus:'temperature',dryMouth:'yes',hotPalms:'yes',nightSweats:'yes',backWeakness:'yes',tinnitus:'yes',tongueCoating:'scant',heatTiming:'evening_night'});
  assert.equal(qualified(yin,'kidneyYinDeficiency'),true);
  assert.equal(qualified(yin,'kidneyYangColdDampBi'),false);
  assert.equal(qualified({...yin,backWeakness:'no',tinnitus:'no'},'kidneyYinDeficiency'),false,'dryness and warmth do not localize a kidney/lever differential');
  const dampHeat = fixture({focus:'pain',pain:'yes',painLocation:'lower_limbs',heaviness:'yes',temperature:'hot',tongueCoating:'yellow_greasy',urination:'scant_dark',edema:'yes',jointWarmth:'no'});
  assert.equal(qualified(dampHeat,'dampHeatLower'),true);
  assert.equal(qualified(dampHeat,'kidneyYangColdDampBi'),false);
  assert.equal(qualified({...dampHeat,painLocation:'head',urination:'normal'},'dampHeatLower'),false,'heat and dampness do not establish lower-Jiao localization');
});

test('E: strong excess heat needs explicit intensity/timing and cannot use deficient-heat clues', () => {
  const excess = fixture({temperature:'hot',heatTiming:'persistent_strong',thirst:'strong_cold',tongueCoating:'yellow_dry',tongueColor:'red',constipation:'yes',irritability:'yes',urination:'scant_dark'});
  assert.equal(qualified(excess,'excessFireToxin'),true);
  for (const heatTiming of ['evening_night','unknown','prefer_not','none']) assert.equal(qualified({...excess,heatTiming},'excessFireToxin'),false);
  assert.equal(qualified({...excess,tongueCoating:'scant',hotPalms:'yes',nightSweats:'yes'},'excessFireToxin'),false);
  assert.match(patternCatalog.find(pattern => pattern.id === 'excessFireToxin')!.explanation,/inte.*bekräftas/i);
});

test('independent discriminators ask about counterevidence and never repeat withheld answers', () => {
  const digestion = fixture({focus:'digestion',energy:'low'});
  const independent = getIndependentDifferentialQuestionIds(digestion);
  assert.ok(independent.includes('reflux') && independent.includes('tongueCoating') && independent.includes('abdominalPain'));
  const hot = fixture({temperature:'hot'});
  assert.ok(getIndependentDifferentialQuestionIds(hot).includes('heatTiming'));
  const stress = fixture({focus:'stress',ribTension:'yes'});
  assert.ok(getIndependentDifferentialQuestionIds(stress).includes('painCharacter'));
  assert.ok(getIndependentDifferentialQuestionIds(stress).includes('currentInfection'));
  const held = {...hot,heatTiming:'unknown',tongueCoating:'prefer_not'};
  const next = getInterviewCompletionQuestionIds(held,analyzePatterns(held));
  assert.ok(!next.includes('heatTiming') && !next.includes('tongueCoating'));
  assert.deepEqual(sanitizeInterviewQuestionIds(['heatTiming','tongueCoating','pulse','priorAssessment'],held),[]);
});

test('the new bank extends curated options without exposing pulse or retired questions', () => {
  assert.equal(questionBank.length,new Set(questionBank.map(question => question.id)).size);
  assert.equal(validateAnswers({heatTiming:'persistent_strong',currentInfection:'no',tongueCoating:'yellow_dry',painLocation:'lower_limbs'}).heatTiming,'persistent_strong');
  assert.throws(() => validateAnswers({heatTiming:'diagnose me'}));
  assert.ok(!questionBank.filter(isPublicQuestion).some(question => ['pulse','priorAssessment'].includes(question.id)));
  assert.equal(new Set(patternCatalog.map(pattern => pattern.id)).size,30);
  for (const pattern of patternCatalog) {
    for (const group of pattern.requiredEvidenceGroups) {
      assert.ok(group.length > 0);
      for (const rule of group) assert.ok(pattern.supportingRules.some(support => support.questionId === rule.questionId && rule.values.every(value => support.values.includes(value))),`${pattern.id}:${rule.questionId} must be visible support`);
    }
  }
});

test('missing evidence, an absent assortment and a dominant off-assortment pattern never force a formula', () => {
  const sparse = buildReport(fixture({focus:'stress',irritability:'yes'}),[]);
  assert.equal(sparse.analysis.primary,null);
  assert.deepEqual(sparse.formulaMatches,[]);
  const outside = fixture({focus:'digestion',foodTrigger:'yes',reflux:'sour',afterMealBloat:'yes',stoolOdor:'yes',onset:'after_food',duration:'weeks'});
  const report = buildReport(outside,[]);
  assert.equal(report.analysis.primary?.id,'foodStagnation');
  assert.equal(report.formulaStatus,'no_match');
  assert.deepEqual(report.formulaMatches,[]);
  assert.deepEqual(analyzePatterns(outside),report.analysis,'formula availability never rewrites the independent differential');
});

const assortmentCases: { id: string; primary: PatternId; answers: AnswerMap }[] = [
  {id:'supplier-athletic',primary:'kidneyYangColdDampBi',answers:{focus:'pain',pain:'yes',painLocation:'back_knees',temperature:'cold',backWeakness:'yes',weatherPain:'yes',painWarmth:'better',stiffness:'yes',energy:'low',jointWarmth:'no',hotPalms:'no',nightSweats:'no',tongueCoating:'normal'}},
  {id:'supplier-coptis-scute',primary:'excessFireToxin',answers:{temperature:'hot',heatTiming:'persistent_strong',thirst:'strong_cold',tongueCoating:'yellow_dry',tongueColor:'red',constipation:'yes',irritability:'yes',urination:'scant_dark',hotPalms:'no',nightSweats:'no'}},
  {id:'supplier-tonic',primary:'qiBloodYangDeficiency',answers:{focus:'energy',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired',temperature:'cold',tongueCoating:'normal',hotPalms:'no'}},
  {id:'supplier-stomach',primary:'spleenQiColdDampStagnation',answers:{focus:'digestion',energy:'after_food',appetite:'low',stool:'loose',heaviness:'yes',afterMealBloat:'yes',tongueCoating:'white_greasy',temperature:'cold',reflux:'belching',abdominalPain:'distending',nausea:'yes',pain:'yes'}},
  {id:'supplier-four-marvel',primary:'dampHeatLower',answers:{focus:'pain',pain:'yes',painLocation:'lower_limbs',heaviness:'yes',temperature:'hot',tongueCoating:'yellow_greasy',urination:'scant_dark',edema:'yes',jointWarmth:'no'}},
  {id:'supplier-relax-resolve',primary:'liverQiStasisHeat',answers:{focus:'stress',ribTension:'yes',stressDigestion:'yes',stressRelief:'yes',irritability:'yes',emotion:'irritable',pain:'yes',painCharacter:'stabbing',tongueColor:'purple',temperature:'hot',pallor:'yes',dizziness:'yes',dryEyes:'yes',hairNails:'yes'}},
  {id:'supplier-six',primary:'kidneyYinDeficiency',answers:{focus:'temperature',dryMouth:'yes',hotPalms:'yes',nightSweats:'yes',backWeakness:'yes',tinnitus:'yes',tongueCoating:'scant',heatTiming:'evening_night'}},
  {id:'supplier-womens',primary:'qiBloodDeficiency',answers:{focus:'energy',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired',tongueCoating:'normal'}},
  {id:'supplier-slbz',primary:'spleenDampness',answers:{focus:'digestion',energy:'after_food',appetite:'low',stool:'loose',heaviness:'yes',afterMealBloat:'yes',tongueCoating:'white_greasy',reflux:'none',abdominalPain:'none',constipation:'no'}},
  {id:'supplier-auranthii',primary:'liverQiStagnation',answers:{focus:'stress',ribTension:'yes',stressDigestion:'yes',stressRelief:'yes',irritability:'yes',emotion:'irritable',pain:'yes',painCharacter:'distending',abdominalPain:'distending',pallor:'no',tongueColor:'normal'}},
];

test('all ten final supplier profiles have a reachable classical reference after independent differentiation', () => {
  assert.equal(assortmentCases.length,10);
  for (const example of assortmentCases) {
    const answers = fixture({currentInfection:'no',...example.answers});
    const independent = analyzePatterns(answers);
    const report = buildReport(answers,formulaSeed);
    assert.equal(independent.primary?.id,example.primary,example.id);
    assert.deepEqual(report.analysis,independent,`${example.id}: the assortment never rewrites the differential`);
    assert.equal(report.formulaStatus,'matched',example.id);
    assert.equal(report.formulaMatches[0]?.formulaId,example.id,`${example.id}: generic patterns must not displace the supported composite`);
    assert.ok(report.formulaMatches.length <= 3);
    for (const match of report.formulaMatches) {
      assert.equal(match.productAvailable,false,'a classical comparison is not a verified available product');
      assert.equal(match.productUrl,null);
    }
  }
});

test('a high independent match cannot override a product contraindication or an unclear required safety answer', () => {
  for (const example of assortmentCases.filter(item => ['supplier-tonic','supplier-womens','supplier-relax-resolve'].includes(item.id))) {
    const clear = fixture({currentInfection:'no',...example.answers});
    const independent = analyzePatterns(clear);
    assert.ok(buildReport(clear,formulaSeed).formulaMatches.some(item => item.formulaId === example.id));
    for (const currentInfection of ['yes','unknown','prefer_not',undefined]) {
      const answers = {...clear};
      if (currentInfection === undefined) delete answers.currentInfection; else answers.currentInfection = currentInfection;
      const report = buildReport(answers,formulaSeed);
      assert.deepEqual(report.analysis,independent,'infection gate is not pattern evidence');
      assert.ok(!report.formulaMatches.some(item => item.formulaId === example.id),`${example.id}:${currentInfection}`);
    }
  }
  const excess = assortmentCases.find(item => item.id === 'supplier-coptis-scute')!;
  const mismatch = buildReport(fixture({...excess.answers,hotPalms:'yes'}),formulaSeed);
  assert.equal(mismatch.analysis.primary?.id,'excessFireToxin','strong points still leave a reviewable independent hypothesis');
  assert.ok(!mismatch.formulaMatches.some(item => item.formulaId === 'supplier-coptis-scute'),'a hard mismatch cannot be offset by a higher score');
});

test('an unexplained high composite score exposes the unmet component and preserves OR alternatives and uncertainty', () => {
  const answers = fixture({focus:'energy',temperature:'cold',energy:'low',weakVoice:'yes',exertion:'tired',pallor:'no',tongueColor:'unknown',menstrualFlow:'prefer_not'});
  const report = buildReport(answers,[]);
  assert.equal(report.analysis.status,'insufficient');
  assert.ok(report.analysis.patterns.find(item => item.id === 'qiBloodYangDeficiency')!.score >= 7);
  const explained = explainAnamnesReport(report,answers);
  const bloodComponent = explained.comparison?.unmetComponents.find(component => component.alternatives.some(item => item.questionId === 'pallor'));
  assert.ok(bloodComponent);
  assert.equal(bloodComponent.alternatives.find(item => item.questionId === 'pallor')?.status,'different_answer');
  assert.equal(bloodComponent.alternatives.find(item => item.questionId === 'tongueColor')?.status,'unknown');
  assert.equal(bloodComponent.alternatives.find(item => item.questionId === 'menstrualFlow')?.status,'withheld');
  assert.deepEqual(bloodComponent.alternatives.find(item => item.questionId === 'pallor')?.expectedAnswers,['Ja']);
  assert.ok(!explained.comparison?.unmetCriteria.some(item => ['pallor','tongueColor','menstrualFlow'].includes(item.questionId)),'OR alternatives are not falsely displayed as three individually mandatory findings');
  assert.equal(explained.direction.hypothesis,null);
});

test('many custom formula safety rules stay blocking while exclusion reasons fit the public report contract', () => {
  const profile = assortmentCases.find(item => item.id === 'supplier-womens')!;
  const answers = fixture({currentInfection:'no',...profile.answers});
  const unresolved = questionBank.filter(question => isPublicQuestion(question) && !Object.hasOwn(answers,question.id)).slice(0,40);
  assert.equal(unresolved.length,40);
  for (const question of unresolved) answers[question.id] = 'unknown';
  const contraindicated = questionBank.filter(question => isPublicQuestion(question) && Object.hasOwn(answers,question.id) && !['unknown','prefer_not'].includes(answers[question.id]!)).slice(0,8);
  assert.equal(contraindicated.length,8);
  const original = formulaSeed.find(formula => formula.id === 'supplier-womens')!;
  const custom = {
    ...original,id:'custom-many-safety-rules',name:'Testreferens med många säkerhetsvillkor',
    requiredSafetyRules:unresolved.map(question => ({questionId:question.id,values:[question.options.find(option => !['unknown','prefer_not'].includes(option.value))!.value],weight:3})),
    contraindicationRules:contraindicated.map(question => ({questionId:question.id,values:[answers[question.id]!],weight:3})),
  };
  const report = buildReport(answers,[custom]);
  assert.equal(report.analysis.primary?.id,'qiBloodDeficiency','uncertain unrelated answers cannot erase the existing independently supported profile');
  assert.ok(report.formulaExclusions.some(item => item.formulaId === custom.id));
  assert.equal(report.formulaExclusions[0].reasons.length,40,'the returned explanation is bounded without clearing any rule');
  assert.doesNotThrow(() => ReportSchema.parse(report));
  assert.notEqual(report.formulaStatus,'matched');
  assert.deepEqual(report.formulaMatches,[]);
});

test('admin-added safety and contraindication questions are prioritized without requiring duplicated question lists', () => {
  const profile = assortmentCases.find(item => item.id === 'supplier-womens')!;
  const answers = fixture(profile.answers);
  const original = formulaSeed.find(formula => formula.id === 'supplier-womens')!;
  const custom = {
    ...original,id:'custom-new-safety-questions',
    requiredSafetyRules:[rule('currentInfection','no'),rule('nightSweats','no')],
    contraindicationRules:[rule('heatTiming','persistent_strong')],
    requiredQuestionIds:['cough' as const],
    opposingRules:[rule('phlegm','yellow')],supportingRules:[rule('windSensitivity','yes')],
  };
  const analysis = analyzePatterns(answers);
  assert.equal(analysis.primary?.id,'qiBloodDeficiency');
  assert.deepEqual(getFormulaComparisonQuestionIds(answers,analysis,[custom]),['currentInfection','nightSweats','heatTiming','cough','phlegm','windSensitivity']);
  const withheld = {...answers,currentInfection:'prefer_not',nightSweats:'unknown',heatTiming:'prefer_not'};
  assert.deepEqual(getFormulaComparisonQuestionIds(withheld,analyzePatterns(withheld),[custom]),['cough','phlegm','windSensitivity'],'an unclear safety answer remains unclear and must never be repeatedly asked');
  const contraindicated = {...answers,heatTiming:'persistent_strong'};
  assert.deepEqual(getFormulaComparisonQuestionIds(contraindicated,analyzePatterns(contraindicated),[custom]),[],'do not continue gathering points for an already excluded reference');
  assert.deepEqual(analyzePatterns(answers),analysis,'custom product rules cannot change the independent pattern analysis');
});
