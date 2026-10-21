import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formulaSeed } from '../src/lib/anamnes/catalog-seed';
import { analyzePatterns, buildReport, canAnalyzePatterns, getNarrativeSafety, getSafetyAssessment } from '../src/lib/anamnes/engine';
import { finalizeInterviewReport, getInterviewCompletionQuestionIds, interviewHasEnoughAnswers } from '../src/lib/anamnes/interview';
import { explainAnamnesReport } from '../src/lib/anamnes/report-explanation';
import { emptyConsultationDetails, type AnswerMap } from '../src/lib/anamnes/types';

const history: AnswerMap={adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no',focus:'energy',duration:'months',onset:'gradual',trend:'stable',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired',currentInfection:'no'};

test('past medication mentions in every own-text context never infer current use or remove supported findings', () => {
  const before=buildReport(history,formulaSeed);
  assert.equal(before.analysis.primary?.id,'qiBloodDeficiency');
  assert.ok(before.formulaMatches.length);
  const syntheticHistory='Syntetiskt fall: tidigare provat medicin utan effekt.';
  for (const field of ['locations','dailyImpact','goal','previousCare','lifestyle'] as const) {
    const consultation={...emptyConsultationDetails(),[field]:syntheticHistory};
    const report=buildReport(history,formulaSeed,{narrative:syntheticHistory,consultation});
    assert.deepEqual(report.analysis,before.analysis);
    assert.deepEqual(report.formulaMatches,before.formulaMatches);
    assert.equal(report.safety.level,'clear');
    assert.ok(!report.safety.flags.some(flag => /läkemedel|medicin/.test(flag)));
  }
  const note=buildReport(history,formulaSeed,{consultation:{...emptyConsultationDetails(),questionNotes:{energy:syntheticHistory}}});
  assert.equal(note.safety.level,'clear');
  for (const text of ['Har testat medicin men det hjälpte inte.','Har slutat med metformin.','Jag tog kortison tidigare.','Har aldrig tagit läkemedel.','Jag använder warfarin.']) {
    assert.equal(getNarrativeSafety(text),null,'the explicit medication answer, not keyword extraction, establishes the current status');
  }
});

test('affirmed medication permits a preliminary pattern and targeted questions while product suitability stays separate', () => {
  const answers: AnswerMap={...history,medication:'yes'};
  const report=buildReport(answers,formulaSeed,{source:'ai',acceptedPatternIds:['qiBloodDeficiency'],consultation:{...emptyConsultationDetails(),medicationDetails:'SYNTHETIC_CLINIC_ONLY_DETAIL'}});
  assert.equal(report.safety.level,'medication_review');
  assert.equal(canAnalyzePatterns(report.safety),true);
  assert.equal(interviewHasEnoughAnswers(answers),true);
  assert.deepEqual(report.analysis,analyzePatterns(history));
  assert.ok(getInterviewCompletionQuestionIds(answers,report.analysis).length);
  const finished=finalizeInterviewReport(report,answers);
  assert.equal(finished.analysis.primary?.id,'qiBloodDeficiency');
  assert.equal(finished.formulaStatus,'matched');
  assert.deepEqual(finished.formulaMatches.map(item => item.formulaId),buildReport(history,formulaSeed).formulaMatches.map(item => item.formulaId));
  assert.ok(finished.formulaMatches.every(item => item.safetyNotes.some(note => /terapeut måste granska.*kontraindikationer/.test(note))));
  const {direction}=explainAnamnesReport(finished,answers);
  assert.equal(direction.status,'preliminary');
  assert.equal(direction.hypothesis?.name,finished.analysis.primary?.name);
  assert.ok(direction.references.length);
  assert.match(direction.formulaMessage,/läkemedel, interaktioner och kontraindikationer/);
  assert.match(report.safety.flags.join(' '),/terapeut måste granska/);
  const stale=buildReport(history,formulaSeed);
  assert.ok(stale.formulaMatches.length);
  const staleDirection=explainAnamnesReport({...stale,safety:{...report.safety,blocksFormulas:true}},answers).direction;
  assert.equal(staleDirection.status,'preliminary');
  assert.deepEqual(staleDirection.references,[],'a stale match cannot override an actual block');
});

test('medication references cannot override product-specific exclusions or become purchase links', () => {
  const answers={...history,medication:'yes'};
  const original=formulaSeed.find(item => item.id==='supplier-womens')!;
  const evidence='Documented synthetic test evidence only';
  const verified={...original,productId:1,productUrl:'/butik/fictional',ingredients:['SYNTHETIC'],productIdentityVerified:true,ingredientsVerified:true,safetyVerified:true,regulatoryVerified:true,identityEvidence:evidence,ingredientEvidence:evidence,safetyEvidence:evidence,regulatoryEvidence:evidence};
  const report=buildReport(answers,[verified]);
  assert.equal(report.formulaStatus,'matched');
  assert.equal(report.formulaMatches[0].productAvailable,false);
  assert.equal(report.formulaMatches[0].productId,null);
  assert.equal(report.formulaMatches[0].productUrl,null);
  for (const rules of [{contraindicationRules:[{questionId:'medication' as const,values:['yes'],weight:3}]},{requiredSafetyRules:[{questionId:'medication' as const,values:['no'],weight:3}]}]) {
    const excluded=buildReport(answers,[{...original,...rules}]);
    assert.equal(excluded.formulaStatus,'no_match');
    assert.deepEqual(excluded.formulaMatches,[]);
    assert.ok(excluded.formulaExclusions.some(item => item.formulaId===original.id));
  }
  assert.equal(buildReport(answers,[original],{formulaReferencesEnabled:false}).formulaStatus,'disabled');
});

test('affirmed medication never bypasses other warnings, unknown safety or acute text in a detail field', () => {
  for (const patch of [{pregnancy:'yes'},{pregnancy:'unknown'},{adult:'no'},{allergy:'yes'},{chronicDisease:'yes'},{liverKidney:'yes'},{emergency:'yes'},{clinicalRedFlags:'yes'}] satisfies AnswerMap[]) {
    const safety=getSafetyAssessment({...history,medication:'yes',...patch});
    assert.equal(canAnalyzePatterns(safety),false,JSON.stringify(patch));
    assert.equal(safety.blocksFormulas,true);
  }
  for (const medication of ['unknown','prefer_not',undefined]) {
    const answers={...history};
    if (medication===undefined) delete answers.medication; else answers.medication=medication;
    assert.equal(canAnalyzePatterns(getSafetyAssessment(answers)),false);
  }
  const safety=getSafetyAssessment({...history,medication:'yes'},'',{...emptyConsultationDetails(),medicationDetails:'Syntetisk akut uppgift: bröstsmärta.'});
  assert.equal(safety.level,'emergency');
  assert.equal(canAnalyzePatterns(safety),false);
  assert.equal(canAnalyzePatterns({level:'clear',blocksFormulas:true,flags:[],missingQuestionIds:[]}),false);
});
