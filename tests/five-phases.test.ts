import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../src/lib/five-phases/questions";
import { calculateResult } from "../src/lib/five-phases/scoring";
import { createSession, parseStoredSession, SESSION_STORAGE_KEY } from "../src/lib/five-phases/session";
import { ELEMENTS, type Answer, type AnswerValue, type ElementType, type TestSession } from "../src/lib/five-phases/types";

function sameAnswers(value: AnswerValue): Answer[] {
  return QUESTIONS.map((question) => ({ questionId: question.id, value }));
}
function answersForTotals(totals: Record<ElementType, number>): Answer[] {
  const remaining = Object.fromEntries(ELEMENTS.map((element) => [element, totals[element] - 8])) as Record<ElementType, number>;
  return QUESTIONS.map((question) => {
    const extra = Math.min(4, remaining[question.element]);
    remaining[question.element] -= extra;
    return { questionId: question.id, value: (extra + 1) as AnswerValue };
  });
}
function session(overrides: Partial<TestSession> = {}): TestSession {
  return { version: 1, questionOrder: QUESTIONS.map((question) => question.id), answers: [], currentIndex: 0, completed: false, ...overrides };
}
const restore = (value: unknown) => parseStoredSession(JSON.stringify(value));
const invalidResult = (value: unknown) => assert.throws(() => calculateResult(value as Answer[]));

test("the specified questionnaire has forty unique questions and eight questions per phase with the required stress mappings", () => {
  assert.equal(QUESTIONS.length, 40);
  assert.deepEqual(QUESTIONS.map((question) => question.id), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.deepEqual(ELEMENTS, ["wood", "fire", "earth", "metal", "water"]);
  for (const element of ELEMENTS) {
    assert.equal(QUESTIONS.filter((question) => question.element === element).length, 8);
    assert.equal(QUESTIONS.filter((question) => question.element === element && question.category === "constitution").length, element === "water" ? 6 : 5);
  }
  assert.deepEqual(QUESTIONS.filter((question) => question.category === "stress").map((question) => question.id), [2, 4, 7, 12, 13, 15, 18, 20, 21, 27, 28, 31, 36, 39]);
  assert.equal(QUESTIONS.filter((question) => question.element === "water" && question.category === "constitution").length, 6);
});

test("all minimum or maximum answers normalize to zero or one hundred and complete ties retain stable phase order", () => {
  for (const [value, rawScore, percentage] of [[1, 8, 0], [5, 40, 100]] as const) {
    const result = calculateResult(sameAnswers(value));
    assert.deepEqual(result.scores, ELEMENTS.map((element) => ({ element, rawScore, percentage })));
    assert.equal(result.primary.element, "wood");
    assert.equal(result.secondary.element, "fire");
    assert.equal(result.isMixed, true);
    assert.deepEqual(result.tiedElements, [...ELEMENTS]);
  }
});

test("winning and secondary phases are determined by the mapped questions rather than answer order", () => {
  const answers = answersForTotals({ wood: 10, fire: 9, earth: 32, metal: 11, water: 40 });
  const result = calculateResult(answers.toReversed());
  assert.deepEqual(result.scores, [
    { element: "water", rawScore: 40, percentage: 100 },
    { element: "earth", rawScore: 32, percentage: 75 },
    { element: "metal", rawScore: 11, percentage: 9 },
    { element: "wood", rawScore: 10, percentage: 6 },
    { element: "fire", rawScore: 9, percentage: 3 },
  ]);
  assert.equal(result.primary.element, "water");
  assert.equal(result.secondary.element, "earth");
  assert.equal(result.isMixed, false);
  assert.deepEqual(result.tiedElements, ["water"]);
});

test("ties include all highest phases and use the declared phase order for a stable primary and secondary", () => {
  const result = calculateResult(answersForTotals({ wood: 12, fire: 36, earth: 36, metal: 9, water: 36 }));
  assert.deepEqual(result.scores.map((score) => score.element), ["fire", "earth", "water", "wood", "metal"]);
  assert.equal(result.primary.element, "fire");
  assert.equal(result.secondary.element, "earth");
  assert.deepEqual(result.tiedElements, ["fire", "earth", "water"]);
  assert.equal(result.isMixed, true);
});

test("mixed constitution uses the inclusive six-point threshold after integer rounding", () => {
  const mixed = calculateResult(answersForTotals({ wood: 38, fire: 36, earth: 20, metal: 15, water: 8 }));
  assert.equal(mixed.primary.percentage, 94);
  assert.equal(mixed.secondary.percentage, 88);
  assert.equal(mixed.isMixed, true);
  // Both cases differ by two raw points. Rounded normalized scores decide it.
  const separate = calculateResult(answersForTotals({ wood: 28, fire: 26, earth: 20, metal: 15, water: 8 }));
  assert.equal(separate.primary.percentage, 63);
  assert.equal(separate.secondary.percentage, 56);
  assert.equal(separate.isMixed, false);
});

test("scoring never mutates answers or question data", () => {
  const answers = Object.freeze(sameAnswers(3).map((answer) => Object.freeze(answer)));
  const originalQuestions = JSON.stringify(QUESTIONS);
  const originalAnswers = JSON.stringify(answers);
  const result = calculateResult(answers);
  assert.ok(result.scores.every((score) => score.rawScore === 24 && score.percentage === 50));
  assert.equal(JSON.stringify(answers), originalAnswers);
  assert.equal(JSON.stringify(QUESTIONS), originalQuestions);
});

test("incomplete, duplicate and unknown question answers cannot produce a result", () => {
  for (const value of [null, undefined, {}, [], sameAnswers(3).slice(0, 39), [...sameAnswers(3), { questionId: 1, value: 3 }]]) invalidResult(value);
  const duplicate = sameAnswers(3);
  duplicate[39] = { questionId: 1, value: 3 };
  invalidResult(duplicate);
  for (const questionId of [0, 41, -1, 1.5, NaN, "1", "__proto__"]) {
    const answers: unknown[] = sameAnswers(3);
    answers[0] = { questionId, value: 3 };
    invalidResult(answers);
  }
});

test("malformed answers and noninteger, out-of-range or coerced values are rejected", () => {
  for (const value of [0, 6, -1, 1.5, NaN, Infinity, "5", true, null, undefined, {}]) {
    const answers: unknown[] = sameAnswers(3);
    answers[0] = { questionId: 1, value };
    invalidResult(answers);
  }
  for (const answer of [null, undefined, 5, "answer", {}, { value: 3 }]) {
    const answers: unknown[] = sameAnswers(3);
    answers[0] = answer;
    invalidResult(answers);
  }
});

test("new sessions shuffle all known IDs without mutating questions or sharing answer/order arrays", (context) => {
  const originalIds = QUESTIONS.map((question) => question.id);
  context.mock.method(Math, "random", () => 0);
  const first = createSession();
  const second = createSession();
  assert.equal(first.version, 1);
  assert.equal(first.currentIndex, 0);
  assert.equal(first.completed, false);
  assert.deepEqual(first.answers, []);
  assert.equal(new Set(first.questionOrder).size, 40);
  assert.deepEqual(first.questionOrder.toSorted((a, b) => a - b), originalIds);
  assert.notDeepEqual(first.questionOrder, originalIds);
  assert.notEqual(first.questionOrder, second.questionOrder);
  assert.notEqual(first.answers, second.answers);
  assert.deepEqual(QUESTIONS.map((question) => question.id), originalIds);
  assert.deepEqual(restore(first), first);
  assert.equal(SESSION_STORAGE_KEY, "tibb.five-phases.session.v1");
});

test("saved progress restores question order, edited answers and backward navigation without recomputing a random order", () => {
  const order = QUESTIONS.map((question) => question.id).toReversed();
  const answers = order.slice(0, 12).map((questionId, index) => ({ questionId, value: ((index % 5) + 1) as AnswerValue }));
  const saved = session({ questionOrder: order, answers, currentIndex: 7 });
  const result = restore(saved)!;
  assert.deepEqual(result, saved);
  assert.notEqual(result.questionOrder, order);
  assert.notEqual(result.answers, answers);
  assert.deepEqual(restore(session({ answers: sameAnswers(4), currentIndex: 39, completed: true })), session({ answers: sameAnswers(4), currentIndex: 39, completed: true }));
  assert.ok(restore(session({ answers: sameAnswers(4), currentIndex: 39, completed: false })));
});

test("invalid JSON, oversized data, changed versions, unexpected fields and invalid indexes are discarded", () => {
  for (const raw of [null, "", "{", "null", "[]", "1", "true", " ".repeat(20_001)]) assert.equal(parseStoredSession(raw), null);
  for (const version of [0, 2, "1", null]) assert.equal(restore({ ...session(), version }), null);
  for (const currentIndex of [-1, 40, 1.5, "0", null]) assert.equal(restore({ ...session(), currentIndex }), null);
  for (const completed of [0, "false", null]) assert.equal(restore({ ...session(), completed }), null);
  assert.equal(restore({ ...session(), result: { primary: "water" } }), null);
  const missingField: Record<string, unknown> = session();
  delete missingField.completed;
  assert.equal(restore(missingField), null);
});

test("tampered question orders, answers and skipped progress cannot be restored", () => {
  const valid = session();
  for (const order of [[], valid.questionOrder.slice(0, 39), [...valid.questionOrder, 41], [...valid.questionOrder.slice(0, 39), 1], [...valid.questionOrder.slice(0, 39), 41], [...valid.questionOrder.slice(0, 39), "40"]])
    assert.equal(restore({ ...valid, questionOrder: order }), null);
  for (const answers of [null, {}, [{ questionId: 41, value: 3 }], [{ questionId: "1", value: 3 }], [{ questionId: 1, value: 6 }], [{ questionId: 1, value: "5" }], [{ questionId: 1, value: 1.5 }], [{ questionId: 1, value: 3, result: "fake" }], [{ questionId: 1, value: 3 }, { questionId: 1, value: 4 }]])
    assert.equal(restore({ ...valid, answers }), null);
  assert.equal(restore({ ...valid, currentIndex: 1 }), null);
  assert.equal(restore({ ...valid, answers: [{ questionId: 2, value: 3 }], currentIndex: 1 }), null);
  assert.equal(restore({ ...valid, completed: true }), null);
  assert.equal(restore({ ...valid, answers: sameAnswers(3).slice(0, 39), currentIndex: 39, completed: true }), null);
  assert.ok(restore({ ...valid, answers: [{ questionId: 1, value: 3 }], currentIndex: 1 }));
});
