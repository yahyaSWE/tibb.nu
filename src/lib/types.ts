export type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "student";
  createdAt: string;
  emailVerifiedAt: string | null;
};
export type Treatment = {
  id: number;
  name: string;
  description: string;
  durationMinutes: number;
  priceOre: number;
  active: boolean;
};
export type Practitioner = {
  id: number;
  name: string;
  description: string;
  active: boolean;
  photoUrl: string | null;
  photo: UploadedMaterial | null;
};
export type UploadKind = "practitioner-photo" | "lesson-material";
export type UploadedMaterial = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  url: string;
};
// Internal metadata for authenticated storage routes; never serialize this
// record to a public page or a browser response.
export type UploadRecord = {
  id: string;
  kind: UploadKind;
  filename: string;
  contentType: string;
  size: number;
  storagePath: string;
  storageProvider: "local" | "blob";
  uploaderId: number;
  courseId: number | null;
  createdAt: string;
};
export type Slot = {
  id: number;
  treatmentId: number;
  treatmentName: string;
  practitionerId: number;
  practitionerName: string;
  start: string;
  end: string;
  booked: boolean;
  blocked: boolean;
  scheduleId: number | null;
};
export type AvailabilityBreak = { startTime: string; endTime: string };
export type AvailabilityScheduleInput = {
  treatmentId: number;
  practitionerId?: number;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  breaks: AvailabilityBreak[];
};
export type AvailabilitySchedule = AvailabilityScheduleInput & {
  id: number;
  practitionerId: number;
  practitionerName: string;
  treatmentName: string;
  createdAt: string;
  created: number;
  skipped: number;
};
export type AvailabilityBlockInput = {
  practitionerId?: number | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  reason: string;
};
export type AvailabilityBlock = {
  id: number;
  practitionerId: number | null;
  practitionerName: string | null;
  start: string;
  end: string;
  allDay: boolean;
  reason: string;
  createdAt: string;
};
export type Booking = {
  id: number;
  reference: string;
  treatmentId: number;
  slotId: number;
  treatmentName: string;
  practitionerId: number;
  practitionerName: string;
  durationMinutes: number;
  priceOre: number;
  start: string;
  end: string;
  name: string;
  email: string;
  phone: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  paymentMethod: "onsite" | "stripe";
  paymentStatus: "pending" | "paid" | "refunded";
  checkoutSessionId: string | null;
  expiresAt: string | null;
  createdAt: string;
};
export type Article = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Course = {
  id: number;
  title: string;
  slug: string;
  description: string;
  priceOre: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Lesson = {
  id: number;
  courseId: number;
  title: string;
  body: string;
  videoUrl: string;
  materialUrl: string;
  materials: UploadedMaterial[];
  position: number;
};
export type Enrollment = {
  id: number;
  userId: number;
  courseId: number;
  name: string;
  email: string;
  courseTitle: string;
  createdAt: string;
};
export type Settings = {
  siteName: string;
  email: string;
  phone: string;
  address: string;
  location: string;
  payOnSite: boolean;
  stripeEnabled: boolean;
};

export type CourseActivityKind = "quiz" | "assignment";
export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctOption: number;
};
export type StudentQuizQuestion = Omit<QuizQuestion, "correctOption">;
export type CourseActivityInput = {
  id?: number;
  courseId: number;
  lessonId: number;
  kind: CourseActivityKind;
  title: string;
  instructions: string;
  position: number;
  active: boolean;
  questions?: QuizQuestion[];
  passPercent?: number;
  // Optional optimistic revision for concurrent admin edits.
  revision?: number;
};
export type CourseActivityBase = {
  id: number;
  courseId: number;
  lessonId: number;
  kind: CourseActivityKind;
  title: string;
  instructions: string;
  position: number;
  active: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type AdminCourseActivity = CourseActivityBase & {
  questions: QuizQuestion[];
  passPercent: number | null;
};
export type QuizAnswer = { questionId: string; optionIndex: number };
export type QuizAnswerResult = {
  questionId: string;
  prompt: string;
  options: string[];
  selectedOption: number;
  correctOption: number;
  correct: boolean;
};
export type QuizAttempt = {
  id: number;
  userId: number;
  activityId: number;
  revision: number;
  attemptNumber: number;
  scorePercent: number;
  correctCount: number;
  questionCount: number;
  passPercent: number;
  passed: boolean;
  answers: QuizAnswerResult[];
  submittedAt: string;
};
export type AssignmentStatus = "draft" | "submitted" | "approved" | "needs_revision";
export type AssignmentSubmission = {
  id: number;
  userId: number;
  activityId: number;
  revision: number;
  text: string;
  status: AssignmentStatus;
  feedback: string;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: number | null;
};
export type StudentCourseActivity = CourseActivityBase & {
  questions: StudentQuizQuestion[];
  passPercent: number | null;
  quizAttempts: QuizAttempt[];
  assignmentSubmissions: AssignmentSubmission[];
};
export type AdminActivityResultContext = {
  courseId: number;
  lessonId: number;
  lessonTitle: string;
  activityTitle: string;
  instructions: string;
  userName: string;
  userEmail: string;
  reviewerName: string | null;
};
export type AdminQuizAttempt = QuizAttempt & AdminActivityResultContext;
export type AdminAssignmentSubmission = AssignmentSubmission & AdminActivityResultContext;
export type CourseActivityResults = {
  quizAttempts: AdminQuizAttempt[];
  assignmentSubmissions: AdminAssignmentSubmission[];
};
