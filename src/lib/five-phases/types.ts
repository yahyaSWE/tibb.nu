export const ELEMENTS = ["wood", "fire", "earth", "metal", "water"] as const;

export type ElementType = (typeof ELEMENTS)[number];
export type AnswerValue = 1 | 2 | 3 | 4 | 5;

export type Question = {
  readonly id: number;
  readonly text: string;
  readonly element: ElementType;
  readonly category: "constitution" | "stress";
};

export type Answer = {
  questionId: number;
  value: AnswerValue;
};

export type ElementScore = {
  element: ElementType;
  rawScore: number;
  percentage: number;
};

export type TestResult = {
  scores: ElementScore[];
  primary: ElementScore;
  secondary: ElementScore;
  isMixed: boolean;
  tiedElements: ElementType[];
};

export type TestSession = {
  version: 1;
  questionOrder: number[];
  answers: Answer[];
  currentIndex: number;
  completed: boolean;
};
