import { QUESTIONS } from "./questions";
import type { Answer, AnswerValue, TestSession } from "./types";

export const SESSION_STORAGE_KEY = "tibb.five-phases.session.v1";
const knownQuestionIds = new Set<number>(QUESTIONS.map((question) => question.id));

// Call on Start/restart events. This helper never accesses browser storage.
export function createSession(): TestSession {
  const questionOrder: number[] = QUESTIONS.map((question) => question.id);
  for (let index = questionOrder.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [questionOrder[index], questionOrder[other]] = [questionOrder[other], questionOrder[index]];
  }
  return { version: 1, questionOrder, answers: [], currentIndex: 0, completed: false };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function parseStoredSession(raw: string | null): TestSession | null {
  if (typeof raw !== "string" || raw.length > 20_000) return null;
  let stored: unknown;
  try { stored = JSON.parse(raw); } catch { return null; }
  if (!record(stored) || !exactKeys(stored, ["version", "questionOrder", "answers", "currentIndex", "completed"])) return null;
  if (stored.version !== 1 || typeof stored.completed !== "boolean") return null;
  if (!Number.isInteger(stored.currentIndex) || typeof stored.currentIndex !== "number" || stored.currentIndex < 0 || stored.currentIndex >= QUESTIONS.length) return null;
  if (!Array.isArray(stored.questionOrder) || stored.questionOrder.length !== QUESTIONS.length) return null;
  const questionOrder: number[] = [];
  const orderedIds = new Set<number>();
  for (const id of stored.questionOrder) {
    if (typeof id !== "number" || !Number.isInteger(id) || !knownQuestionIds.has(id) || orderedIds.has(id)) return null;
    orderedIds.add(id);
    questionOrder.push(id);
  }
  if (!Array.isArray(stored.answers) || stored.answers.length > QUESTIONS.length) return null;
  const answers: Answer[] = [];
  const answeredIds = new Set<number>();
  for (const answer of stored.answers) {
    if (!record(answer) || !exactKeys(answer, ["questionId", "value"])) return null;
    const { questionId, value } = answer;
    if (typeof questionId !== "number" || !Number.isInteger(questionId) || !knownQuestionIds.has(questionId) || answeredIds.has(questionId)) return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) return null;
    answeredIds.add(questionId);
    answers.push({ questionId, value: value as AnswerValue });
  }
  if (stored.completed && answers.length !== QUESTIONS.length) return null;
  // Saved progress cannot have bypassed an unanswered previous question.
  if (questionOrder.slice(0, stored.currentIndex).some((id) => !answeredIds.has(id))) return null;
  return { version: 1, questionOrder, answers, currentIndex: stored.currentIndex, completed: stored.completed };
}
