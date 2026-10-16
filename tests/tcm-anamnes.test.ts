import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyseIntake, initialIntake, makeSummary, patterns, type Intake, type Symptom,
} from '../src/lib/tcm-anamnes';

const intake = (overrides: Partial<Intake> = {}): Intake => ({
  ...initialIntake, adult: 'yes', pregnantOrNursing: 'no', emergency: 'no',
  focus: 'stress', symptoms: ['stressGut', 'costal', 'irritable'], ...overrides,
});
function blocked(value: unknown, status: 'incomplete' | 'emergency' = 'incomplete') {
  const result = analyseIntake(value);
  assert.equal(result.status, status);
  assert.equal(result.confident, false);
  assert.equal(result.canShowFormulaReferences, false);
  assert.deepEqual(result.matches, []);
  return result;
}
function noFormulas(summary: string) {
  for (const pattern of patterns) assert.ok(!summary.includes(pattern.formula), `Unexpected formula ${pattern.formula}`);
}

test('all ten supplied pattern references retain their example weights and ranking', () => {
  const examples: Array<[string, string, Intake['focus'], Symptom[], number]> = [
    ['xys', 'Xiao Yao San', 'stress', ['stressGut', 'costal', 'irritable'], 12],
    ['xslj', 'Xiang Sha Liu Jun Zi Tang', 'digestion', ['afterMealBloat', 'lowAppetite', 'nausea'], 13],
    ['bzyq', 'Bu Zhong Yi Qi Tang', 'energy', ['sinking', 'weakVoice', 'lowEnergy'], 13],
    ['szrt', 'Suan Zao Ren Tang', 'sleep', ['sleepStart', 'wakeNight', 'irritable'], 9],
    ['ypfs', 'Yu Ping Feng San', 'immunity', ['frequentSick', 'spontSweat', 'weakVoice'], 13],
    ['gpt', 'Gui Pi Tang', 'sleep', ['rumination', 'mentalTired', 'sleepStart'], 11],
    ['bzt', 'Ba Zhen Tang', 'energy', ['pale', 'dizzy', 'scantMenses'], 13],
    ['dhjst', 'Du Huo Ji Sheng Tang', 'joints', ['jointChronic', 'betterWarm', 'backWeak'], 13],
    ['sms', 'Si Miao San', 'heat', ['hotJoint', 'legHeavy', 'urineBurn'], 15],
    ['lwdh', 'Liu Wei Di Huang Wan', 'heat', ['nightSweats', 'dryMouth', 'tinnitus'], 14],
  ];
  assert.deepEqual(patterns.map(pattern => [pattern.id, pattern.formula]), examples.map(([id, formula]) => [id, formula]));
  for (const [id, formula, focus, symptoms, points] of examples) {
    const result = analyseIntake(intake({ focus, symptoms }));
    assert.equal(result.status, 'ready');
    assert.equal(result.confident, true);
    assert.equal(result.matches[0].id, id);
    assert.equal(result.matches[0].formula, formula);
    assert.equal(result.matches[0].points, points);
  }
});

test('empty and partially answered safety and core questions cannot produce hypotheses', () => {
  blocked(initialIntake);
  for (const key of ['adult', 'pregnantOrNursing', 'emergency', 'focus'] as const) blocked(intake({ [key]: '' }));
  blocked(intake({ symptoms: [] }));
  for (const key of ['adult', 'pregnantOrNursing', 'emergency', 'meds', 'chronic', 'allergies', 'focus', 'symptoms'] as const) {
    const incomplete: Record<string, unknown> = { ...intake() };
    delete incomplete[key];
    blocked(incomplete);
  }
});

test('an acute answer short-circuits scoring even before other mandatory answers exist', () => {
  blocked({ emergency: 'yes' }, 'emergency');
  blocked(intake({ emergency: 'yes' }), 'emergency');
  blocked({ ...intake(), emergency: 'yes', symptoms: null, adult: 'invalid' }, 'emergency');
  const summary = makeSummary(intake({ emergency: 'yes' }), analyseIntake(intake()));
  assert.match(summary, /Självskattningen avbröts/);
  assert.match(summary, /112/);
  assert.ok(!summary.includes('TCM-mönsterhypoteser:'));
  noFormulas(summary);
});

test('invalid runtime inputs and prototype-like keys are rejected without leaking arbitrary data', () => {
  for (const value of [null, undefined, false, 3, 'answers', [], {}, new Date()]) blocked(value);
  for (const field of ['adult', 'pregnantOrNursing', 'emergency', 'focus', 'heat', 'tongue', 'duration'] as const) {
    for (const value of [null, false, 1, {}, [], 'unknown', '__proto__', 'constructor']) blocked({ ...intake(), [field]: value });
  }
  for (const field of ['meds', 'chronic', 'allergies'] as const) {
    for (const value of [null, undefined, 0, 1, 'false', 'yes']) blocked({ ...intake(), [field]: value });
  }
  for (const symptoms of [null, undefined, {}, 'stressGut', ['unknown'], ['__proto__'], ['constructor'], ['stressGut', 1], ['stressGut', null], new Array(3), [, 'stressGut']]) {
    blocked({ ...intake(), symptoms });
  }
  const summary = makeSummary({ ...intake(), duration: 'UNTRUSTED_PAYLOAD', symptoms: ['UNKNOWN_SYMPTOM'] });
  assert.ok(!summary.includes('UNTRUSTED_PAYLOAD'));
  assert.ok(!summary.includes('UNKNOWN_SYMPTOM'));
  noFormulas(summary);
  assert.match(makeSummary({ ...intake(), adult: false }), /18 år eller äldre: Ej besvarat/);
  assert.match(makeSummary({ ...intake(), meds: 'no' }), /Regelbundna läkemedel eller kosttillskott: Ej besvarat/);
});

test('optional observations accept every declared choice and may be omitted', () => {
  for (const heat of ['', 'cold', 'warm', 'neutral', 'unsure'] as const) assert.equal(analyseIntake(intake({ heat })).status, 'ready');
  for (const tongue of ['', 'pale', 'red', 'greasy', 'normal', 'unsure'] as const) assert.equal(analyseIntake(intake({ tongue })).status, 'ready');
  for (const duration of ['', 'days', 'weeks', 'months', 'years', 'unsure'] as const) assert.equal(analyseIntake(intake({ duration })).status, 'ready');
  const noObservations: Record<string, unknown> = { ...intake() };
  delete noObservations.heat;
  delete noObservations.tongue;
  delete noObservations.duration;
  assert.equal(analyseIntake(noObservations).status, 'ready');
});

test('one or two distinct symptoms never gain heuristic confidence from duplicates', () => {
  for (const symptoms of [['stressGut'], ['stressGut', 'costal']] as Symptom[][]) {
    const result = analyseIntake(intake({ symptoms: [...symptoms, ...symptoms, ...symptoms] }));
    assert.equal(result.status, 'ready');
    assert.equal(result.confident, false);
    assert.deepEqual(result.matches, []);
    assert.equal(result.canShowFormulaReferences, false);
  }
  const answers = intake();
  assert.deepEqual(analyseIntake({ ...answers, symptoms: [...answers.symptoms].reverse().concat(answers.symptoms) }), analyseIntake(answers));
  assert.equal(makeSummary({ ...answers, symptoms: [...answers.symptoms].reverse().concat(answers.symptoms) }), makeSummary(answers));
});

test('the original thresholds retain a close secondary hypothesis and stable catalog order in ties', () => {
  const tied = intake({ focus: 'digestion', symptoms: ['afterMealBloat', 'lowAppetite', 'looseStool', 'stressGut', 'costal'] });
  const matches = analyseIntake(tied).matches;
  assert.deepEqual(matches.map(match => [match.id, match.points]), [['xys', 12], ['xslj', 12]]);
  assert.deepEqual(analyseIntake({ ...tied, symptoms: [...tied.symptoms].reverse() }).matches, matches);
  const close = analyseIntake(intake({ focus: 'sleep', symptoms: ['sleepStart', 'wakeNight', 'nightSweats'] }));
  assert.deepEqual(close.matches.map(match => [match.id, match.points]), [['szrt', 10], ['lwdh', 7]]);
  const sparse = analyseIntake(intake({ focus: 'joints', symptoms: ['lowAppetite', 'weakVoice', 'nightSweats'] }));
  assert.equal(sparse.confident, false);
  assert.deepEqual(sparse.matches, []);
});

test('each individual risk blocks formula references while retaining ready pattern context', () => {
  assert.equal(analyseIntake(intake()).canShowFormulaReferences, true);
  for (const risk of [{ adult: 'no' }, { pregnantOrNursing: 'yes' }, { meds: true }, { chronic: true }, { allergies: true }] as Partial<Intake>[]) {
    const answers = intake(risk);
    const result = analyseIntake(answers);
    assert.equal(result.status, 'ready');
    assert.equal(result.higherRisk, true);
    assert.equal(result.confident, true);
    assert.equal(result.canShowFormulaReferences, false);
    noFormulas(makeSummary(answers));
  }
});

test('each existing caution symptom blocks formulas independently of the general risk flags', () => {
  for (const symptom of ['hotJoint', 'urineBurn', 'palpitations', 'dizzy'] as const) {
    const answers = intake({ symptoms: [...intake().symptoms, symptom] });
    const result = analyseIntake(answers);
    assert.equal(result.status, 'ready');
    assert.equal(result.higherRisk, false);
    assert.equal(result.clinicalCaution, true);
    assert.equal(result.confident, true);
    assert.equal(result.canShowFormulaReferences, false);
    noFormulas(makeSummary(answers));
  }
});

test('summary renders Swedish observations and individual safety answers with the same formula gate', () => {
  const summary = makeSummary(intake({ heat: 'cold', tongue: 'greasy', duration: 'months' }));
  for (const text of [
    '18 år eller äldre: Ja', 'Gravid eller ammar: Nej', 'Akuta allvarliga symtom: Nej',
    'Regelbundna läkemedel eller kosttillskott: Nej', 'Långvarig sjukdom eller medicinsk behandling: Nej',
    'Allergier eller reaktion på örtpreparat: Nej', 'Temperatur: Ofta frusen',
    'Tunga: Tjock eller kladdig beläggning', 'Varaktighet: Månader', 'Xiao Yao San',
    'inte behandlings-, inköps- eller doseringsråd',
  ]) assert.ok(summary.includes(text), `Missing ${text}`);
  const unknown = makeSummary(intake({ heat: 'unsure', tongue: 'unsure', duration: 'unsure' }));
  assert.match(unknown, /Temperatur: Vet inte/);
  assert.match(unknown, /Tunga: Vet inte/);
  assert.match(unknown, /Varaktighet: Vet inte/);
  const risky = makeSummary(intake({ adult: 'no', pregnantOrNursing: 'yes', meds: true, chronic: true, allergies: true }));
  assert.match(risky, /18 år eller äldre: Nej/);
  assert.match(risky, /Gravid eller ammar: Ja/);
  assert.match(risky, /Regelbundna läkemedel eller kosttillskott: Ja/);
  assert.match(risky, /Långvarig sjukdom eller medicinsk behandling: Ja/);
  assert.match(risky, /Allergier eller reaktion på örtpreparat: Ja/);
  noFormulas(risky);
});

test('summary rederives eligibility rather than trusting stale analysis and ignores unrelated personal fields', () => {
  const earlier = analyseIntake(intake());
  const incomplete = makeSummary({ ...intake(), adult: '' }, earlier);
  assert.match(incomplete, /Ofullständiga eller ogiltiga svar/);
  assert.match(incomplete, /18 år eller äldre: Ej besvarat/);
  assert.ok(!incomplete.includes('TCM-mönsterhypoteser:'));
  noFormulas(incomplete);
  noFormulas(makeSummary(intake({ allergies: true }), earlier));
  const answers = intake();
  assert.equal(makeSummary({ ...answers, email: 'private@example.test', name: 'PRIVATE_NAME' }), makeSummary(answers));
});

test('calculation and summary do not mutate answers or pattern definitions', () => {
  const answers = Object.freeze({ ...intake(), symptoms: Object.freeze(intake().symptoms) });
  const answersBefore = JSON.stringify(answers);
  const patternsBefore = JSON.stringify(patterns);
  analyseIntake(answers);
  makeSummary(answers);
  assert.equal(JSON.stringify(answers), answersBefore);
  assert.equal(JSON.stringify(patterns), patternsBefore);
});
