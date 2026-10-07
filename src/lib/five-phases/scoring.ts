import { QUESTIONS } from "./questions";
import { ELEMENTS, type Answer, type ElementScore, type ElementType, type TestResult } from "./types";

const questionElements = new Map<number, ElementType>(QUESTIONS.map((question) => [question.id, question.element]));

export function calculateResult(answers: readonly Answer[]): TestResult {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length)
    throw new Error("Besvara alla 40 frågor innan du visar resultatet.");

  const totals: Record<ElementType, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const answeredIds = new Set<number>();
  for (const answer of answers) {
    if (!answer || typeof answer !== "object" || !Number.isInteger(answer.questionId))
      throw new Error("Ett av svaren hör inte till testets frågor.");
    const element = questionElements.get(answer.questionId);
    if (!element) throw new Error("Ett av svaren hör inte till testets frågor.");
    if (answeredIds.has(answer.questionId)) throw new Error("Varje fråga måste ha exakt ett svar.");
    if (!Number.isInteger(answer.value) || answer.value < 1 || answer.value > 5)
      throw new Error("Varje svar måste vara ett heltal mellan 1 och 5.");
    answeredIds.add(answer.questionId);
    totals[element] += answer.value;
  }

  const scores: ElementScore[] = ELEMENTS.map((element) => ({
    element,
    rawScore: totals[element],
    percentage: Math.round(((totals[element] - 8) / 32) * 100),
  }));
  scores.sort((first, second) => second.rawScore - first.rawScore || ELEMENTS.indexOf(first.element) - ELEMENTS.indexOf(second.element));
  const primary = scores[0];
  const secondary = scores[1];
  return {
    scores,
    primary,
    secondary,
    isMixed: primary.percentage - secondary.percentage <= 6,
    tiedElements: scores.filter((score) => score.rawScore === primary.rawScore).map((score) => score.element),
  };
}
