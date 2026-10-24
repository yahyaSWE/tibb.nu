import type { StoredQualityReview } from '../src/lib/anamnes/quality-contract';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmObservations, removeConfirmedObservation, validateExtractedObservations } from '../src/lib/anamnes/observations';
import { analyzePatterns, analyzePatternsBaseline } from '../src/lib/anamnes/engine';
import { assessPattern, defaultWeightingPolicy } from '../src/lib/anamnes/assessment';
import { getInterviewDecision } from '../src/lib/anamnes/interview';
import { diagnosticInformationGain } from '../src/lib/anamnes/differential';
import { normalizeConsultationDetails, consultationForAi, consultationDetailsText } from '../src/lib/anamnes/consultation';
import { patternById, patternCatalog } from '../src/lib/anamnes/patterns';
import { qualityCases } from '../src/lib/anamnes/quality-cases';
import { compareQualityCases, qualityDatasetVersion, QualityReviewSchema, replayQualityCase } from '../src/lib/anamnes/quality';
import { validateAnswers } from '../src/lib/anamnes/questions';
import { buildReport } from '../src/lib/anamnes/engine';
import { formatAnamnesSummary } from '../src/lib/anamnes/summary';
import { emptyConsultationDetails, type AnswerMap } from '../src/lib/anamnes/types';

const safety:AnswerMap={adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no'};
const background:AnswerMap={focus:'digestion',duration:'months',onset:'gradual',trend:'stable'};
const proposal=(questionId:string,answer:string|null,excerpt:string,extra={})=>({questionId,answer,certainty:'explicit',polarity:'affirmed',evidence:[{source:'narrative',sourceQuestionId:null,excerpt}],...extra});

test('extracted text remains a proposal until an intentional patient confirmation',()=>{
  const details=emptyConsultationDetails(),answers={...safety},story='Jag är trött och har lös avföring.';
  const observations=validateExtractedObservations({observations:[proposal('energy','low','Jag är trött'),proposal('stool','loose','lös avföring')]},answers,story,details);
  assert.equal(observations.length,2);assert.equal(answers.energy,undefined);
  const none=confirmObservations(answers,details,observations,[]);assert.equal(none.answers.energy,undefined);
  const result=confirmObservations(answers,details,observations,[{questionId:'energy',answer:'normal',use:true},{questionId:'stool',answer:'loose',use:false}]);
  assert.equal(result.answers.energy,'normal');assert.equal(result.answers.stool,undefined);
  assert.equal(result.consultation.confirmedObservations?.[0].corrected,true);
  assert.match(consultationDetailsText(result.consultation),/Jag är trött/);
  assert.equal('confirmedObservations' in consultationForAi(result.consultation),false);
  const summary=formatAnamnesSummary(buildReport(result.answers,[]),result.answers,story,'',result.consultation);
  assert.match(summary,/TOLKNINGAR SOM BESÖKAREN UTTRYCKLIGEN BEKRÄFTAT/);
  assert.match(summary,/räknas en gång/);assert.match(summary,/Jag är trött/);
});

test('extraction rejects forged quotes, unavailable options, safety and professional observations',()=>{
  const items=[proposal('energy','low','uppfunnet citat'),proposal('stool','invented','trött'),proposal('medication','yes','trött'),proposal('pulse','weak','trött'),proposal('priorAssessment','yes','trött')];
  assert.deepEqual(validateExtractedObservations({observations:items},{},'trött',emptyConsultationDetails()),[]);
  const details={...emptyConsultationDetails(),medicationDetails:'Hemlig säkerhetsuppgift',questionNotes:{medication:'Läkemedelsnotering'}};
  assert.deepEqual(validateExtractedObservations({observations:[{...proposal('energy','low','Läkemedelsnotering'),evidence:[{source:'questionNote',sourceQuestionId:'medication',excerpt:'Läkemedelsnotering'}]}]}, {},'',details),[]);
});

test('denied, uncertain and contradictory statements stay distinct; duplicate IDs score once',()=>{
  const story='Jag har inte ont. Ibland är jag trött, ibland normal.';
  const list=validateExtractedObservations({observations:[proposal('pain','no','Jag har inte ont',{polarity:'denied'}),proposal('energy','low','trött'),proposal('energy','normal','normal'),proposal('pain','no','Jag har inte ont',{polarity:'denied'})]}, {},story,emptyConsultationDetails());
  assert.equal(list.length,2);assert.equal(list.find(item=>item.questionId==='pain')?.answer,'no');
  assert.equal(list.find(item=>item.questionId==='energy')?.answer,null);assert.equal(list.find(item=>item.questionId==='energy')?.certainty,'uncertain');
  const result=confirmObservations({},emptyConsultationDetails(),list,[{questionId:'pain',answer:'no',use:true},{questionId:'pain',answer:'yes',use:true}]);
  assert.deepEqual(result.answers,{pain:'no'});assert.equal(result.consultation.confirmedObservations?.length,1);
});

test('equivalent sleep observations are confirmed and scored only once; revocation preserves manual changes',()=>{
  const story='Jag har svårt att somna.';
  const list=validateExtractedObservations({observations:[proposal('sleepOnset','yes',story),proposal('sleep','difficulty',story)]},{},story,emptyConsultationDetails());
  const result=confirmObservations({},emptyConsultationDetails(),list,[{questionId:'sleepOnset',answer:'yes',use:true},{questionId:'sleep',answer:'difficulty',use:true}]);
  assert.deepEqual(result.answers,{sleep:'difficulty'});
  const removed=removeConfirmedObservation(result.answers,result.consultation,'sleep');assert.deepEqual(removed.answers,{});
  const manual=removeConfirmedObservation({...result.answers,sleep:'normal'},result.consultation,'sleep');assert.equal(manual.answers.sleep,'normal');
  const normalized=normalizeConsultationDetails(result.consultation,{sleep:'normal'});assert.deepEqual(normalized.confirmedObservations,[]);
});

test('normalized assessment records missing core and independent compound components without new qualification thresholds',()=>{
  const item=qualityCases.find(item=>item.engineeringTarget==='qiBloodYangDeficiency')!;
  const answers={...item.answers,temperature:'unknown'};
  const finding=analyzePatterns(answers).patterns.find(finding=>finding.id==='qiBloodYangDeficiency')!;
  assert.equal(finding.qualified,false);assert.ok(finding.assessment?.missingCoreQuestionIds.includes('temperature'));
  assert.equal(finding.assessment?.components.find(component=>component.id==='qi_deficiency')?.state,'supported');
  assert.equal(finding.assessment?.components.find(component=>component.id==='cold')?.state,'unknown');
  const contradicted=analyzePatterns({...answers,temperature:'hot'}).patterns.find(item=>item.id==='qiBloodYangDeficiency');
  assert.equal(contradicted?.assessment?.state,'conflicting_evidence');
  for(const fixture of qualityCases){const current=analyzePatterns(fixture.answers),old=analyzePatternsBaseline(fixture.answers);assert.deepEqual(current.patterns.filter(item=>item.qualified).map(item=>item.id),old.patterns.filter(item=>item.qualified).map(item=>item.id));}
});

test('criterion coverage and weights are inspectable; longer rule lists do not earn unobserved support',()=>{
  const answers=qualityCases[0].answers,definition=patternById.get('spleenQiDeficiency')!,finding=analyzePatterns(answers).patterns.find(item=>item.id===definition.id)!;
  const standard=assessPattern(definition,finding,answers);
  const longer=assessPattern({...definition,supportingRules:[...definition.supportingRules,{questionId:'dryEyes',values:['yes'],weight:4}]},finding,answers);
  assert.equal(standard.supportWeight,longer.supportWeight);assert.ok(longer.normalizedSupport<standard.normalizedSupport);
  assert.ok(standard.assessedCriteria<=standard.totalCriteria);
  assert.throws(()=>assessPattern(definition,finding,answers,{...defaultWeightingPolicy,coreMultiplier:0}));
});

test('information gain prioritizes unresolved core and differences, never repeated or withheld questions',()=>{
  const answers:AnswerMap={...safety,...background,energy:'low',stool:'loose',afterMealBloat:'yes',heaviness:'yes',appetite:'low',tongueCoating:'white_greasy',reflux:'belching'};
  const analysis=analyzePatterns(answers),decision=getInterviewDecision(answers,analysis);
  assert.ok(diagnosticInformationGain('temperature',answers,analysis).value>0);
  assert.ok(decision.rankedQuestions.some(item=>item.questionId==='temperature'));
  assert.equal(diagnosticInformationGain('stool',answers,analysis).value,0);
  const withheld={...answers,temperature:'prefer_not'};
  assert.ok(getInterviewDecision(withheld,analyzePatterns(withheld)).rankedQuestions.every(item=>item.questionId!=='temperature'));
});

test('the question budget stays soft for missing core evidence beyond 25 symptoms',()=>{
  const fixture=qualityCases.find(item=>item.engineeringTarget==='spleenQiColdDampStagnation')!;
  const answers:AnswerMap={...fixture.answers};delete answers.temperature;
  for(const item of qualityCases){for(const id of Object.keys(item.answers)){if(!(id in answers)&&!['temperature','pulse','priorAssessment'].includes(id))answers[id as keyof AnswerMap]='unknown';}}
  const decision=getInterviewDecision(answers,analyzePatterns(answers));
  assert.ok(decision.answeredSymptomCount>25);assert.ok(decision.rankedQuestions.some(item=>item.questionId==='temperature'));
});

test('50 versioned fictional scenarios are replayable with no duplicate questions and no invented expert labels',()=>{
  assert.equal(qualityCases.length,50);assert.equal(new Set(qualityCases.map(item=>item.id)).size,50);assert.equal(patternCatalog.length,30);
  for(const item of qualityCases){validateAnswers(item.answers);for(const mode of ['baseline','adaptive'] as const){const result=replayQualityCase(item,mode);assert.equal(result.repeats,0);assert.equal(new Set(result.history).size,result.history.length);}}
  const comparison=compareQualityCases(qualityCases);assert.equal(comparison.reviewed,0);assert.equal(comparison.baseline.exactAgreement,null);assert.equal(comparison.adaptive.exactAgreement,null);
  assert.equal(comparison.orderStableCases,50);assert.ok(comparison.adaptive.medianSymptomQuestions<=25);
  const result=replayQualityCase(qualityCases[0],'adaptive');
  const review:StoredQualityReview={datasetVersion:qualityDatasetVersion,caseId:qualityCases[0].id,expectedPatterns:result.patternIds,expectedStatus:result.state,notes:'Technical review fixture, not an expert judgement.',approved:true as const,revision:1,reviewerId:1,reviewerName:'Test reviewer',reviewedAt:new Date().toISOString()};
  assert.equal(compareQualityCases(qualityCases,[review]).reviewed,1);
  assert.equal(compareQualityCases(qualityCases,[review]).adaptive.exactAgreement,1);
  assert.equal(QualityReviewSchema.safeParse({...review,approved:false}).success,false);
  assert.equal(QualityReviewSchema.safeParse({datasetVersion:'old',caseId:'case-001',expectedPatterns:[],expectedStatus:'insufficient_evidence',notes:'Independent review',approved:true,revision:0}).success,false);
});
