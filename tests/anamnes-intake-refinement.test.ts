import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectiveAnswer, questionCovered, questionRelevant } from '../src/lib/anamnes/answer-context';
import { analyzePatterns, buildReport } from '../src/lib/anamnes/engine';
import { formulaSeed } from '../src/lib/anamnes/catalog-seed';
import { getFormulaComparisonQuestionIds, getInterviewCompletionQuestionIds, sanitizeInterviewQuestionIds } from '../src/lib/anamnes/interview';
import { patternById, rule } from '../src/lib/anamnes/patterns';
import { specialOrderDraft, specialOrderSeed, specialOrderSourceLibrary } from '../src/lib/anamnes/special-order-catalog';
import { FormulaRecordSchema, type AnswerMap } from '../src/lib/anamnes/types';
import { questionById, validateFormulaRules } from '../src/lib/anamnes/questions';

const safety: AnswerMap = {adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no'};
const catalog = [...formulaSeed,...specialOrderSeed];
// Entirely synthetic, structured fixture. No patient's story is used here.
const food: AnswerMap = {...safety,focus:'digestion',duration:'weeks',onset:'after_food',trend:'variable',energy:'normal',temperature:'neutral',sleep:'normal',appetite:'variable',stool:'loose',thirst:'normal',sweating:'normal',emotion:'calm',pain:'no',afterMealBloat:'yes',nausea:'yes',foodTrigger:'yes',reflux:'sour',abdominalPain:'cramping',heaviness:'no',tongueCoating:'white_greasy',currentInfection:'no',stoolOdor:'yes'};

test('only equivalent structured sleep/sweating options cover narrower questions, preserving explicit uncertainty', () => {
  const input: AnswerMap = {...safety,sleep:'difficulty',sweating:'night'};
  const original = structuredClone(input);
  assert.deepEqual(effectiveAnswer(input,'sleepOnset'),{questionId:'sleep',value:'yes'});
  assert.deepEqual(effectiveAnswer(input,'nightSweats'),{questionId:'sweating',value:'yes'});
  assert.equal(questionCovered(input,'nightWaking'),false);
  assert.deepEqual(effectiveAnswer({...input,sleepOnset:'unknown'},'sleepOnset'),{questionId:'sleepOnset',value:'unknown'});
  assert.deepEqual(effectiveAnswer({...input,sleepOnset:'prefer_not'},'sleepOnset'),{questionId:'sleepOnset',value:'prefer_not'});
  assert.equal(effectiveAnswer({...input,sleep:'unrested'},'sleepOnset'),null);
  assert.deepEqual(input,original,'navigation never inserts inferred answers');
  const answers: AnswerMap = {...safety,focus:'sleep',duration:'months',onset:'gradual',trend:'stable',sleep:'normal'};
  assert.deepEqual(sanitizeInterviewQuestionIds(['sleepOnset','nightWaking','dreams','energy'],answers,analyzePatterns(answers),{allowNarrativeQuestions:true}),['energy']);
});

test('covered evidence retains its actual selected source and never fabricates a new observation', () => {
  const answers: AnswerMap = {...safety,sleep:'difficulty',pallor:'yes',tongueColor:'pale',dryEyes:'yes',hairNails:'yes',rumination:'yes'};
  const analysis = analyzePatterns(answers);
  const finding = analysis.patterns.find(pattern => pattern.id==='liverBloodShenDisturbance')!;
  assert.ok(finding.supporting.some(item => item.questionId==='sleep' && item.answer==='difficulty'));
  assert.ok(!finding.supporting.some(item => item.questionId==='sleepOnset'));
  assert.equal(answers.sleepOnset,undefined);
});

test('digestion history completes by relevant content with no repetition or arbitrary round limit', () => {
  const answers: AnswerMap = {...safety};
  const asked: string[] = [];
  // This guard detects a regression in the test; production has no such cap.
  for (let batch=0;batch<100;batch++) {
    const analysis = analyzePatterns(answers);
    const next = [...new Set([...getInterviewCompletionQuestionIds(answers,analysis),...getFormulaComparisonQuestionIds(answers,analysis,catalog)])].slice(0,3);
    if (!next.length) break;
    for (const id of next) {
      assert.equal(questionCovered(answers,id),false,`repeated ${id}`);
      assert.ok(questionById.get(id) && !questionById.get(id)!.professionalOnly);
      asked.push(id);
      answers[id]=food[id]??'unknown';
    }
  }
  assert.equal(asked.length,new Set(asked).size);
  assert.ok(asked.length+8<=34,`unexpectedly long history: ${asked.length+8}`);
  assert.ok(!asked.some(id => ['painCharacter','painLocation','sleepOnset','nightWaking'].includes(id)));
  assert.ok(asked.includes('currentInfection'),'reference safety is still clarified');
  assert.deepEqual(getInterviewCompletionQuestionIds(answers,analyzePatterns(answers)),[]);
  const result=buildReport(answers,catalog);
  assert.equal(result.analysis.primary?.id,'foodStagnation');
  assert.ok(!result.analysis.conflicts.length,'abdominal pain does not contradict denied musculoskeletal pain');
  assert.ok(result.formulaMatches.some(match => match.formulaId==='special-book-040'));
});

test('custom reference safety rules retain priority even when general symptom detail is irrelevant', () => {
  const answers: AnswerMap = {...safety,focus:'energy',duration:'months',onset:'gradual',trend:'stable',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired',pain:'no'};
  const custom={...formulaSeed.find(item => item.id==='supplier-womens')!,requiredSafetyRules:[rule('jointWarmth','no')],contraindicationRules:[],requiredQuestionIds:[],opposingRules:[]};
  assert.equal(questionRelevant(answers,'jointWarmth'),false);
  assert.deepEqual(getFormulaComparisonQuestionIds(answers,analyzePatterns(answers),[custom]),['jointWarmth']);
  assert.deepEqual(getFormulaComparisonQuestionIds({...answers,jointWarmth:'unknown'},analyzePatterns(answers),[custom]),[]);
  assert.ok(!buildReport({...answers,jointWarmth:'unknown'},[custom]).formulaMatches.length);
});

test('book library and eleven mapped references retain provenance without asserting product availability', () => {
  assert.equal(specialOrderSourceLibrary.length,127);
  assert.equal(new Set(specialOrderSourceLibrary.map(item => item.id)).size,127);
  assert.equal(specialOrderSeed.length,11);
  for (const source of specialOrderSourceLibrary) {
    assert.equal(source.documentSha256,'a5e0e5360a5c29347be1c2255ecadc9a6b7d6bd11810b8f4f7179edff18a124e');
    assert.ok(source.pages.every(page => page>=1 && page<=146));
    assert.ok(source.ingredientStatement && source.traditionalDescription);
  }
  for (const reference of specialOrderSeed) {
    assert.ok(validateFormulaRules(reference),reference.id);
    assert.ok(reference.primaryPatternIds.every(id => patternById.has(id)));
    assert.equal(reference.referenceKind,'special_order');
    assert.ok(reference.referenceSource && specialOrderSourceLibrary.some(source => source.id===reference.referenceSource!.id));
    assert.deepEqual(reference.ingredients,[],'source ingredients are not asserted as verified product contents');
    assert.ok(!reference.productIdentityVerified && !reference.ingredientsVerified && !reference.safetyVerified && !reference.regulatoryVerified);
    assert.equal(reference.productId,null);
  }
  const unmapped=specialOrderSourceLibrary.find(source => !specialOrderSeed.some(reference => reference.id===source.id))!;
  const draft=specialOrderDraft(unmapped.id)!;
  assert.equal(draft.active,false);
  assert.equal(draft.referenceKind,'special_order');
  assert.deepEqual(draft.primaryPatternIds,[],'an administrator must choose a reviewed mapping');
  assert.equal(FormulaRecordSchema.safeParse(draft).success,false,'an unmapped draft cannot be activated without editing');
  assert.equal(specialOrderDraft('invented'),null);
});

test('a supported special-order reference never becomes a purchasable product or bypasses safety', () => {
  const original=specialOrderSeed.find(item => item.id==='special-book-040')!;
  const spoofed={...original,productIdentityVerified:true,ingredientsVerified:true,safetyVerified:true,regulatoryVerified:true,productId:1,productUrl:'/butik/fictional',ingredients:['Fictional'],identityEvidence:'x'.repeat(30),ingredientEvidence:'x'.repeat(30),safetyEvidence:'x'.repeat(30),regulatoryEvidence:'x'.repeat(30)};
  const reference=buildReport(food,[spoofed]).formulaMatches[0];
  assert.equal(reference.referenceKind,'special_order');
  assert.equal(reference.productAvailable,false);
  assert.equal(reference.productId,null);
  assert.equal(reference.productUrl,null);
  for (const currentInfection of ['yes','unknown','prefer_not']) {
    assert.ok(!buildReport({...food,currentInfection},[original]).formulaMatches.length);
  }
  assert.ok(!buildReport({...food,medication:'yes'},[original]).formulaMatches.length);
  assert.ok(!buildReport({...food,clinicalRedFlags:'yes'},[original]).formulaMatches.length);
  assert.ok(!buildReport({},catalog).formulaMatches.length);
  assert.ok(!buildReport(food,catalog,{source:'ai',acceptedPatternIds:[]}).formulaMatches.length,'model uncertainty cannot force a closest product');
});
