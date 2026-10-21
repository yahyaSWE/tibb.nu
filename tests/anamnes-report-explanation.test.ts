import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReport } from '../src/lib/anamnes/engine';
import { formulaSeed } from '../src/lib/anamnes/catalog-seed';
import { explainAnamnesReport } from '../src/lib/anamnes/report-explanation';
import type { AnswerMap } from '../src/lib/anamnes/types';

const safety: AnswerMap = {adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no'};
// A synthetic regression fixture reproduces an incomplete pain comparison:
// cold-sensitive stiffness alone does not establish a heat-relieved Bi profile.
const pain: AnswerMap = {...safety,focus:'pain',duration:'years',trend:'variable',priorAssessment:'unknown',temperature:'neutral',irritability:'yes',ribTension:'no',stressRelief:'yes',painLocation:'muscles',painCharacter:'distending',painWarmth:'neutral',painMovement:'better',weatherPain:'yes',stiffness:'yes',tongueColor:'red'};

test('incomplete pain answers still receive a factual summary and an explanation of unmet rules', () => {
  const report = buildReport(pain,[]);
  assert.equal(report.analysis.status,'insufficient');
  const explained = explainAnamnesReport(report,pain);
  assert.deepEqual(explained.overview,['Område: Muskler och leder','Besvärens varaktighet: År','Förlopp: Kommer och går','Tidigare vårdbedömning: Vet inte']);
  assert.equal(explained.observations[0].questionId,'painLocation');
  assert.ok(explained.comparison?.supporting.some(label => label.includes('stelhet')));
  const warm = explained.comparison?.unmetCriteria.find(item => item.questionId === 'painWarmth');
  assert.equal(warm?.status,'different_answer');
  assert.equal(warm?.answer,'Ingen tydlig skillnad');
  assert.ok(explained.comparison?.unmetCriteria.some(item => item.questionId === 'ribTension' && item.status === 'different_answer' && item.answer === 'Nej'));
  assert.match(explained.limitations.join(' '),/inte att dina besvär saknar en förklaring/);
  assert.match(explained.nextSteps.join(' '),/konsultation/);
  const plain = JSON.stringify(explained);
  assert.doesNotMatch(plain,/Lever-Qi|Vind-Kyla|Du Huo|dosering|köp/);
  assert.equal(explained.coverage.unknown,1);
  assert.equal(explained.direction.status,'uncertain');
  assert.equal(explained.direction.hypothesis,null);
  assert.deepEqual(explained.direction.references,[]);
});

test('unknown, withheld, unanswered and differently answered criteria stay distinct', () => {
  const input: AnswerMap = {...pain,ribTension:'unknown',painWarmth:'prefer_not'};
  const explained = explainAnamnesReport(buildReport(input,[]),input);
  assert.equal(explained.comparison?.unmetCriteria.find(item => item.questionId === 'ribTension')?.status,'unknown');
  assert.equal(explained.comparison?.unmetCriteria.find(item => item.questionId === 'painWarmth')?.status,'withheld');
  assert.ok(explained.comparison?.unmetCriteria.some(item => item.status === 'not_asked'));
  assert.equal(explained.coverage.unknown,2);
  assert.equal(explained.coverage.withheld,1);
  assert.equal(explained.coverage.known + explained.coverage.unknown + explained.coverage.withheld,explained.coverage.answered);
  assert.match(explained.limitations.join(' '),/inte som ett nej/);
  assert.equal(explained.observations.find(item => item.questionId === 'painWarmth'),undefined);
});

test('an uncertain AI differential cannot be replaced with rule-qualified candidates', () => {
  const input: AnswerMap = {...safety,focus:'energy',duration:'months',trend:'stable',priorAssessment:'yes',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',exertion:'tired',tongueColor:'pale',currentInfection:'no'};
  const report = buildReport(input,[],{source:'ai',acceptedPatternIds:[]});
  assert.ok(report.analysis.patterns.some(pattern => pattern.qualified));
  const explained = explainAnamnesReport(report,input);
  assert.equal(explained.comparison,null);
  assert.match(explained.limitations.join(' '),/AI- och regelbedömningen är fortfarande osäker/);
  assert.doesNotMatch(JSON.stringify(explained),/Qi- och Blodbrist|Qi Xue|Ba Zhen/);
  assert.equal(explained.direction.status,'uncertain');
  assert.equal(explained.direction.hypothesis,null);
  assert.deepEqual(explained.direction.references,[]);
});

test('emergency reports keep only the safety direction and no comparison', () => {
  const input: AnswerMap = {...pain,emergency:'yes'};
  const explained = explainAnamnesReport(buildReport(input,[]),input);
  assert.equal(explained.comparison,null);
  assert.deepEqual(explained.observations,[]);
  assert.match(explained.limitations.join(' '),/112/);
  assert.doesNotMatch(explained.nextSteps.join(' '),/konsultation/);
});

test('empty input is not a diagnosis and limits output without introducing unsupported facts', () => {
  const explained = explainAnamnesReport(buildReport({},[]),{});
  assert.deepEqual(explained.overview,[]);
  assert.deepEqual(explained.observations,[]);
  assert.equal(explained.comparison,null);
  assert.deepEqual(explained.coverage,{answered:0,known:0,unknown:0,withheld:0});
  assert.doesNotMatch(JSON.stringify(explained),/tungan|stelhet|Blodbrist|Ba Zhen|mg|kapsel/);
  assert.throws(() => explainAnamnesReport(buildReport({},[]),{painCharacter:'invented'}));
});

test('a clear qualified main pattern can give direction with only existing checked formula references', () => {
  const input: AnswerMap = {...safety,focus:'energy',duration:'months',trend:'stable',priorAssessment:'yes',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',exertion:'tired',tongueColor:'pale',currentInfection:'no'};
  const report = buildReport(input,formulaSeed);
  assert.equal(report.analysis.status,'preliminary');
  assert.ok(report.analysis.primary?.qualified);
  assert.equal(report.formulaStatus,'matched');
  const {direction} = explainAnamnesReport(report,input);
  assert.equal(direction.status,'preliminary');
  assert.equal(direction.hypothesis?.name,report.analysis.primary.name);
  assert.match(direction.heading,/Svaren lutar inom TCM-modellen åt/);
  assert.deepEqual(direction.references,report.formulaMatches.slice(0,3).map(formula => ({name:formula.name,partial:formula.partial})));
  assert.match(direction.evaluationNotice,/Preliminärt TCM-underlag/);
  assert.match(direction.evaluationNotice,/terapeut.*före eventuell användning av örter/);
  assert.doesNotMatch(JSON.stringify(direction),/dosering|köp|rekommenderas att ta/);

  const partialReport = {...report,formulaMatches:report.formulaMatches.map(formula => ({...formula,partial:true}))};
  const partial = explainAnamnesReport(partialReport,input).direction;
  assert.ok(partial.references.every(reference => reference.partial));
  assert.match(partial.formulaMessage,/inte täcker hela symtombilden/);
});

test('direction never fills an absent formula match or bypasses disabled references', () => {
  const input: AnswerMap = {...safety,focus:'pain',duration:'years',trend:'stable',priorAssessment:'yes',pain:'yes',painCharacter:'stabbing',tongueColor:'purple',menstrualPain:'clots_pain',abdominalPain:'sharp',temperature:'neutral',thirst:'normal'};
  const report = buildReport(input,formulaSeed);
  assert.equal(report.analysis.status,'preliminary');
  assert.ok(report.analysis.primary);
  assert.equal(report.formulaStatus,'no_match');
  const {direction} = explainAnamnesReport(report,input);
  assert.equal(direction.status,'preliminary');
  assert.deepEqual(direction.references,[]);
  assert.match(direction.formulaMessage,/Ingen av de aktiva formlerna/);
  const disabled = explainAnamnesReport({...report,formulaReferencesEnabled:false,formulaStatus:'disabled'},input).direction;
  assert.deepEqual(disabled.references,[]);
  assert.match(disabled.formulaMessage,/avstängda/);
  const noMain = explainAnamnesReport({...report,analysis:{...report.analysis,primary:null}},input).direction;
  assert.equal(noMain.status,'uncertain');
  assert.equal(noMain.hypothesis,null);
  assert.deepEqual(noMain.references,[]);
});

test('all safety blocks suppress the direction and even stale formula references', () => {
  const input: AnswerMap = {...safety,focus:'energy',duration:'months',trend:'stable',priorAssessment:'yes',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',exertion:'tired',tongueColor:'pale',currentInfection:'no'};
  const clearReport = buildReport(input,formulaSeed);
  assert.ok(clearReport.formulaMatches.length);
  for (const level of ['emergency','medical_review','consultation','incomplete','clear'] as const) {
    const report = {...clearReport,safety:{...clearReport.safety,level,blocksFormulas:true}};
    const {direction} = explainAnamnesReport(report,input);
    assert.equal(direction.status,'safety_blocked',level);
    assert.equal(direction.hypothesis,null,level);
    assert.deepEqual(direction.references,[],level);
    assert.doesNotMatch(direction.heading,/lutar/);
  }
});

test('close qualified alternatives retain their lower report comparisons without forcing a main direction', () => {
  const input: AnswerMap = {...safety,focus:'energy',duration:'months',trend:'stable',priorAssessment:'yes',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',exertion:'tired',tongueColor:'pale',currentInfection:'no',dryEyes:'yes',hairNails:'yes'};
  const report = buildReport(input,formulaSeed);
  assert.equal(report.analysis.status,'preliminary');
  assert.equal(report.analysis.primary,null);
  assert.ok(report.analysis.patterns.filter(pattern => pattern.qualified).length >= 2);
  assert.equal(report.formulaStatus,'matched');
  assert.ok(report.formulaMatches.length > 0);
  const {direction} = explainAnamnesReport(report,input);
  assert.equal(direction.status,'uncertain');
  assert.equal(direction.hypothesis,null);
  assert.deepEqual(direction.references,report.formulaMatches.slice(0,3).map(match => ({name:match.name,partial:true})));
  assert.match(direction.formulaMessage,/Ingen formelreferens kan prioriteras som huvudalternativ/);
  assert.match(direction.formulaMessage,/Jämförelserna längre ned.*behandlare/);
  assert.doesNotMatch(direction.formulaMessage,/Ingen formelreferens kan väljas/);
});
