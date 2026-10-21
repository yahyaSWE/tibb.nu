import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReport } from '../src/lib/anamnes/engine';
import { formulaSeed } from '../src/lib/anamnes/catalog-seed';
import { formatAnamnesSummary } from '../src/lib/anamnes/summary';
import type { AnswerMap } from '../src/lib/anamnes/types';

const answers: AnswerMap = {
  adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no',
  focus:'energy',duration:'months',onset:'gradual',trend:'stable',priorAssessment:'yes',temperature:'neutral',thirst:'normal',sweating:'normal',
  energy:'low',appetite:'normal',stool:'normal',sleep:'normal',emotion:'calm',pain:'no',stressDigestion:'no',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired',currentInfection:'no',
};

test('a copied AI summary preserves uncertainty instead of presenting rejected rule candidates', () => {
  const report = buildReport(answers,formulaSeed,{source:'ai',acceptedPatternIds:[]});
  assert.ok(report.analysis.patterns.some(pattern => pattern.qualified));
  const summary = formatAnamnesSummary(report,answers);
  assert.match(summary,/AI-assisterad/);
  assert.match(summary,/Ingen tydlig huvudförklaring/);
  assert.doesNotMatch(summary,/Qi Xue Liang Xu|Ba Zhen Tang/);
  assert.match(summary,/Blir rösten svag eller trött lätt\? Ja/);
  assert.doesNotMatch(summary,/https?:\/\//);
});

test('an emergency summary contains the care direction and answers, with no pattern or formula section', () => {
  const input: AnswerMap = {...answers,emergency:'yes'};
  const summary = formatAnamnesSummary(buildReport(input,formulaSeed),input);
  assert.match(summary,/Ring 112/);
  assert.doesNotMatch(summary,/PRELIMINÄRA TCM-MÖNSTER|FORMELREFERENSER|Ba Zhen Tang/);
  assert.match(summary,/tecken på allvarlig allergisk reaktion\? Ja/);
});

test('an insufficient summary explains the stated pain history and unmet criteria without inventing a diagnosis', () => {
  const input: AnswerMap = {adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no',focus:'pain',duration:'years',trend:'variable',priorAssessment:'unknown',temperature:'neutral',irritability:'yes',ribTension:'no',stressRelief:'yes',painLocation:'muscles',painCharacter:'distending',painWarmth:'neutral',painMovement:'better',weatherPain:'yes',stiffness:'yes',tongueColor:'red'};
  const report = buildReport(input, formulaSeed);
  const summary = formatAnamnesSummary(report, input);
  assert.equal(report.analysis.status, 'insufficient');
  assert.match(summary, /Område: Muskler och leder/);
  assert.match(summary, /Tidigare vårdbedömning: Vet inte/);
  assert.match(summary, /Hur påverkas värken av mjuk rörelse\? Lindras/);
  assert.match(summary, /betyder inte att dina besvär saknar en förklaring/);
  assert.match(summary, /UPPGIFTER SOM BEGRÄNSAR REGELJÄMFÖRELSEN/);
  assert.match(summary, /obligatoriskt villkor/);
  assert.doesNotMatch(summary, /Primär hypotes:|Lever-Qi-stagnation|Du Huo Ji Sheng Tang/);
});

test('a copied supported direction keeps the therapist assessment beside its existing formula reference', () => {
  const report = buildReport(answers, formulaSeed);
  assert.ok(report.analysis.primary);
  assert.ok(report.formulaMatches.length > 0);
  const summary = formatAnamnesSummary(report, answers);
  assert.ok(summary.includes(`Svaren lutar inom TCM-modellen åt ${report.analysis.primary.name}`));
  assert.ok(summary.includes(`Formelreferens att utvärdera: ${report.formulaMatches[0].name}`));
  assert.match(summary, /Behöver utvärderas av en terapeut/);
  assert.match(summary, /före eventuell användning av örter/);
});

test('medication names are exported as visitor-supplied text only for an affirmative answer', () => {
  const input: AnswerMap = { ...answers, medication: 'yes' };
  const report = buildReport(input, formulaSeed);
  const before = structuredClone(report);
  const names = '  Syntetiskt läkemedel A\nSyntetiskt tillskott B  ';
  const summary = formatAnamnesSummary(report, input, '', names);
  assert.match(summary, /Angivna läkemedel eller kosttillskott \(besökarens egna uppgifter\): Syntetiskt läkemedel A\nSyntetiskt tillskott B/);
  assert.equal(report.safety.blocksFormulas, false);
  assert.ok(report.formulaMatches.length);
  assert.match(summary,/terapeut måste granska dina läkemedel, möjliga interaktioner och kontraindikationer/);
  assert.deepEqual(report, before);
  for (const answer of ['no', 'unknown', 'prefer_not']) {
    const changed = { ...input, medication: answer };
    assert.doesNotMatch(formatAnamnesSummary(report, changed, '', names), /Syntetiskt läkemedel A|Syntetiskt tillskott B/);
  }
  const unanswered = { ...input };
  delete unanswered.medication;
  assert.doesNotMatch(formatAnamnesSummary(report, unanswered, '', names), /Syntetiskt läkemedel A|Syntetiskt tillskott B/);
});

test('a copied incomplete composite retains alternative missing findings without inventing a main pattern', () => {
  const input: AnswerMap = {...answers,temperature:'cold',pallor:'no',tongueColor:'unknown',menstrualFlow:'prefer_not',dizziness:'no',dryEyes:'no',hairNails:'no'};
  const report = buildReport(input,[]);
  const text = formatAnamnesSummary(report,input);
  assert.equal(report.analysis.status,'insufficient');
  assert.match(text,/DELKOMPONENTER SOM SAKNAR STÖD/);
  assert.match(text,/ALTERNATIVT:/);
  assert.match(text,/Vet inte/);
  assert.match(text,/Vill inte svara/);
  assert.doesNotMatch(text,/Primär hypotes:/);
});
