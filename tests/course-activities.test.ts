import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createFirstAdmin, createUser, getDb, getCourseProgress, type User } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";
import {
  getAdminCourseActivities, getCourseActivityResults, getStudentLessonActivities,
  reviewAssignment, saveAssignment, saveCourseActivity, submitQuiz,
} from "../src/lib/course-activities";
import type { CourseActivityInput, QuizAnswer } from "../src/lib/types";

const directory = mkdtempSync(join(tmpdir(), "tibb-activities-"));
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;
process.env.TIBB_DATABASE_PATH = join(directory, "activities.sqlite");
let admin: User, student: User, other: User, outsider: User;
let courseId: number, lessonId: number, secondLessonId: number, secondCourseId: number;
const questions = () => [
  { id: "first", prompt: "Första frågan", options: ["Rätt först", "Fel först"], correctOption: 0 },
  { id: "second", prompt: "Andra frågan", options: ["Fel sedan", "Rätt sedan"], correctOption: 1 },
];
const correct: QuizAnswer[] = [{ questionId: "second", optionIndex: 1 }, { questionId: "first", optionIndex: 0 }];
function quiz(overrides: Partial<CourseActivityInput> = {}): CourseActivityInput {
  return { courseId, lessonId, title: "Kunskapsquiz", instructions: "Första instruktionen", kind: "quiz",
    position: 1, active: true, questions: questions(), passPercent: 75, ...overrides };
}
function assignment(overrides: Partial<CourseActivityInput> = {}): CourseActivityInput {
  return { courseId, lessonId, title: "Reflektion", instructions: "Ursprunglig bedömningsinstruktion", kind: "assignment",
    position: 2, active: true, ...overrides };
}
function quizInput(activityId: number, answers = correct, revision = 1) {
  return { activityId, courseId, lessonId, revision, answers };
}
function assignmentInput(activityId: number, text = "Mitt genomarbetade svar", submit = true, revision = 1) {
  return { activityId, courseId, lessonId, revision, text, submit };
}
before(async () => {
  admin = await createFirstAdmin({ name: "Activity teacher", email: "teacher@example.test", passwordHash: hashPassword("local fixture only password") });
  student = await createUser({ name: "Activity student", email: "student@example.test", role: "student", passwordHash: hashPassword("local student fixture password") });
  other = await createUser({ name: "Other student", email: "other@example.test", role: "student", passwordHash: hashPassword("other local fixture password") });
  outsider = await createUser({ name: "Unenrolled student", email: "outsider@example.test", role: "student", passwordHash: hashPassword("outsider local fixture password") });
  const now = new Date().toISOString();
  courseId = Number((await getDb().prepare("INSERT INTO courses(title,slug,published,created_at,updated_at) VALUES(?,?,1,?,?)").run("Activity course", "activity-course", now, now)).lastInsertRowid);
  secondCourseId = Number((await getDb().prepare("INSERT INTO courses(title,slug,published,created_at,updated_at) VALUES(?,?,1,?,?)").run("Other course", "other-activity-course", now, now)).lastInsertRowid);
  lessonId = Number((await getDb().prepare("INSERT INTO lessons(course_id,title,body) VALUES(?,?,?)").run(courseId, "Activity lesson", "Existing lesson content")).lastInsertRowid);
  secondLessonId = Number((await getDb().prepare("INSERT INTO lessons(course_id,title,body) VALUES(?,?,?)").run(courseId, "Second lesson", "Existing second lesson")).lastInsertRowid);
  for (const user of [student, other]) await getDb().prepare("INSERT INTO enrollments(user_id,course_id,created_at) VALUES(?,?,?)").run(user.id, courseId, now);
  await getDb().prepare("INSERT INTO progress(user_id,lesson_id,completed_at) VALUES(?,?,?)").run(student.id, lessonId, now);
});
after(async () => {
  await getDb().close();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith("tibb-activities-"));
  await rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
});

test("students receive questions without answer keys and only their own post-submission histories", async () => {
  const activityId = await saveCourseActivity(admin.id, quiz());
  let activity = (await getStudentLessonActivities(student.id, courseId, lessonId)).find((row) => row.id === activityId)!;
  assert.deepEqual(activity.quizAttempts, []);
  assert.ok(activity.questions.every((question) => !Object.hasOwn(question, "correctOption")));
  assert.doesNotMatch(JSON.stringify(activity), /correctOption|Rätt först.*correct/);
  await submitQuiz(other.id, quizInput(activityId));
  activity = (await getStudentLessonActivities(student.id, courseId, lessonId)).find((row) => row.id === activityId)!;
  assert.deepEqual(activity.quizAttempts, []);
  const own = await submitQuiz(student.id, quizInput(activityId));
  activity = (await getStudentLessonActivities(student.id, courseId, lessonId)).find((row) => row.id === activityId)!;
  assert.deepEqual(activity.quizAttempts.map((attempt) => attempt.id), [own.id]);
  assert.ok(activity.questions.every((question) => !Object.hasOwn(question, "correctOption")));
  assert.ok(activity.quizAttempts[0].answers.every((answer) => answer.correct));
  const teacher = (await getAdminCourseActivities(admin.id, courseId)).find((row) => row.id === activityId)!;
  assert.equal(teacher.questions[0].correctOption, 0);
});

test("quiz grading uses server keys, pass boundaries and atomic sequential attempt numbers", async () => {
  const activityId = await saveCourseActivity(admin.id, quiz({ passPercent: 50 }));
  const partial = await submitQuiz(student.id, quizInput(activityId, [{ questionId: "first", optionIndex: 0 }, { questionId: "second", optionIndex: 0 }]));
  assert.equal(partial.scorePercent, 50);
  assert.equal(partial.correctCount, 1);
  assert.equal(partial.passed, true);
  const failed = await submitQuiz(student.id, quizInput(activityId, [{ questionId: "first", optionIndex: 1 }, { questionId: "second", optionIndex: 0 }]));
  assert.equal(failed.scorePercent, 0);
  assert.equal(failed.passed, false);
  const simultaneous = await Promise.all([submitQuiz(student.id, quizInput(activityId)), submitQuiz(student.id, quizInput(activityId))]);
  assert.deepEqual(simultaneous.map((attempt) => attempt.attemptNumber).toSorted(), [3, 4]);
  assert.ok(simultaneous.every((attempt) => attempt.scorePercent === 100 && attempt.passed));
  assert.deepEqual(await getCourseProgress(student.id, courseId), [lessonId]);
});

test("invalid quiz answers cannot create attempts, including duplicates, unknown IDs and forged answer keys", async () => {
  const activityId = await saveCourseActivity(admin.id, quiz());
  for (const answers of [
    [], [{ questionId: "first", optionIndex: 0 }],
    [{ questionId: "first", optionIndex: 0 }, { questionId: "first", optionIndex: 1 }],
    [{ questionId: "first", optionIndex: 0 }, { questionId: "unknown", optionIndex: 1 }],
    [{ questionId: "first", optionIndex: 9 }, { questionId: "second", optionIndex: 1 }],
    [{ questionId: "first", optionIndex: -1 }, { questionId: "second", optionIndex: 1 }],
    [{ questionId: "first", optionIndex: 0, correctOption: 0 }, { questionId: "second", optionIndex: 1 }],
  ]) await assert.rejects(submitQuiz(student.id, quizInput(activityId, answers as QuizAnswer[])));
  assert.equal(Number((await getDb().prepare("SELECT COUNT(*) AS total FROM quiz_attempts WHERE activity_id=?").get(activityId))!.total), 0);
});

test("roles, enrollment, course ownership, active state and publishing are enforced by domain functions", async () => {
  const activityId = await saveCourseActivity(admin.id, quiz());
  await assert.rejects(saveCourseActivity(student.id, quiz()), /tillgång|behörighet/);
  await assert.rejects(getAdminCourseActivities(student.id, courseId), /behörighet/);
  await assert.rejects(getCourseActivityResults(student.id, courseId), /behörighet/);
  await assert.rejects(getStudentLessonActivities(outsider.id, courseId, lessonId), /tillgång/);
  await assert.rejects(submitQuiz(outsider.id, quizInput(activityId)), /tillgång/);
  await assert.rejects(submitQuiz(student.id, { ...quizInput(activityId), lessonId: secondLessonId }), /tillhör/);
  await assert.rejects(submitQuiz(student.id, { ...quizInput(activityId), courseId: secondCourseId }), /tillgång/);
  await assert.rejects(saveCourseActivity(admin.id, quiz({ id: activityId, lessonId: secondLessonId })), /tillhör/);
  await getDb().prepare("UPDATE courses SET published=0 WHERE id=?").run(courseId);
  await assert.rejects(getStudentLessonActivities(student.id, courseId, lessonId), /tillgång/);
  await assert.rejects(submitQuiz(student.id, quizInput(activityId)), /tillgång/);
  assert.ok((await getStudentLessonActivities(admin.id, courseId, lessonId)).some((row) => row.id === activityId));
  await getDb().prepare("UPDATE courses SET published=1 WHERE id=?").run(courseId);
  await saveCourseActivity(admin.id, quiz({ id: activityId, active: false }));
  assert.ok(!(await getStudentLessonActivities(student.id, courseId, lessonId)).some((row) => row.id === activityId));
  await assert.rejects(submitQuiz(student.id, quizInput(activityId)), /tillgängligt/);
});

test("revisions preserve grading snapshots and reject stale student and admin edits", async () => {
  const activityId = await saveCourseActivity(admin.id, quiz());
  const first = await submitQuiz(student.id, quizInput(activityId));
  const edited = questions(); edited[0] = { ...edited[0], prompt: "Ändrad fråga", correctOption: 1 };
  await saveCourseActivity(admin.id, quiz({ id: activityId, revision: 1, title: "Nytt quiz", questions: edited }));
  await assert.rejects(submitQuiz(student.id, quizInput(activityId)), /ändrats/);
  await assert.rejects(saveCourseActivity(admin.id, quiz({ id: activityId, revision: 1 })), /ändrats/);
  await assert.rejects(saveCourseActivity(admin.id, assignment({ id: activityId })), /typ/);
  const activity = (await getStudentLessonActivities(student.id, courseId, lessonId)).find((row) => row.id === activityId)!;
  assert.equal(activity.revision, 2);
  assert.deepEqual(activity.quizAttempts, [first]);
  assert.equal(activity.quizAttempts[0].answers[0].prompt, "Första frågan");
  assert.equal(activity.quizAttempts[0].answers[0].correctOption, 0);
  const second = await submitQuiz(student.id, quizInput(activityId, correct, 2));
  assert.equal(second.scorePercent, 50);
  const results = await getCourseActivityResults(admin.id, courseId);
  assert.equal(results.quizAttempts.find((attempt) => attempt.id === first.id)!.activityTitle, "Kunskapsquiz");
  await saveCourseActivity(admin.id, quiz({ id: activityId, revision: 2, title: "Nytt quiz", questions: edited, active: false }));
  assert.ok((await getCourseActivityResults(admin.id, courseId)).quizAttempts.some((attempt) => attempt.id === first.id));
  assert.equal((await getAdminCourseActivities(admin.id, courseId)).find((row) => row.id === activityId)!.revision, 2);
});

test("activity validation is atomic and refuses invalid questions and empty assignment instructions", async () => {
  const before = Number((await getDb().prepare("SELECT COUNT(*) AS total FROM course_activities").get())!.total);
  for (const input of [
    quiz({ questions: [] }), quiz({ passPercent: 0 }), quiz({ questions: [questions()[0], questions()[0]] }),
    quiz({ questions: [{ ...questions()[0], correctOption: 2 }] }),
    quiz({ questions: [{ ...questions()[0], options: ["Samma", "Samma"] }] }),
    assignment({ instructions: "  " }), quiz({ title: " ", position: 0 }),
  ]) await assert.rejects(saveCourseActivity(admin.id, input));
  assert.equal(Number((await getDb().prepare("SELECT COUNT(*) AS total FROM course_activities").get())!.total), before);
});

test("assignment drafts stay private, persist across saves and become immutable submitted histories", async () => {
  const activityId = await saveCourseActivity(admin.id, assignment());
  const draft = await saveAssignment(student.id, assignmentInput(activityId, "Privat utkast", false));
  const again = await saveAssignment(student.id, assignmentInput(activityId, "Ändrat privat utkast", false));
  assert.equal(draft.id, again.id);
  assert.equal(again.status, "draft");
  assert.equal((await getCourseActivityResults(admin.id, courseId)).assignmentSubmissions.some((row) => row.id === draft.id), false);
  assert.equal((await getStudentLessonActivities(other.id, courseId, lessonId)).find((row) => row.id === activityId)!.assignmentSubmissions.length, 0);
  await assert.rejects(reviewAssignment(admin.id, { submissionId: draft.id, courseId, lessonId, status: "approved", feedback: "" }), /inte skickat/);
  const submitted = await saveAssignment(student.id, assignmentInput(activityId));
  assert.equal(submitted.id, draft.id);
  assert.equal(submitted.status, "submitted");
  assert.ok(submitted.submittedAt);
  const newDraft = await saveAssignment(student.id, assignmentInput(activityId, "Nästa privata utkast", false));
  assert.notEqual(newDraft.id, submitted.id);
  const historical = await getDb().prepare("SELECT body,status FROM assignment_submissions WHERE id=?").get(submitted.id);
  assert.equal(historical!.body, "Mitt genomarbetade svar");
  assert.equal(historical!.status, "submitted");
  await assert.rejects(saveAssignment(student.id, assignmentInput(activityId, "   ")), /Skriv ditt svar/);
});

test("assignment reviews use historical instructions and enforce fresh reviewer role and ownership", async () => {
  const activityId = await saveCourseActivity(admin.id, assignment());
  const submitted = await saveAssignment(student.id, assignmentInput(activityId));
  await saveCourseActivity(admin.id, assignment({ id: activityId, revision: 1, instructions: "Ny och annorlunda instruktion" }));
  await assert.rejects(saveAssignment(student.id, assignmentInput(activityId)), /ändrats/);
  const old = (await getCourseActivityResults(admin.id, courseId)).assignmentSubmissions.find((row) => row.id === submitted.id)!;
  assert.equal(old.instructions, "Ursprunglig bedömningsinstruktion");
  await assert.rejects(reviewAssignment(student.id, { submissionId: submitted.id, courseId, lessonId, status: "approved", feedback: "" }), /tillgång/);
  await assert.rejects(reviewAssignment(admin.id, { submissionId: submitted.id, courseId, lessonId: secondLessonId, status: "approved", feedback: "" }), /tillhör/);
  await assert.rejects(reviewAssignment(admin.id, { submissionId: submitted.id, courseId: secondCourseId, lessonId, status: "approved", feedback: "" }), /tillgång/);
  await assert.rejects(reviewAssignment(admin.id, { submissionId: submitted.id, courseId, lessonId, status: "needs_revision", feedback: "" }), /Beskriv/);
  await getDb().prepare("UPDATE users SET role='student' WHERE id=?").run(admin.id);
  await assert.rejects(reviewAssignment(admin.id, { submissionId: submitted.id, courseId, lessonId, status: "approved", feedback: "" }), /tillgång/);
  await getDb().prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.id);
  await reviewAssignment(admin.id, { submissionId: submitted.id, courseId, lessonId, status: "needs_revision", feedback: "Utveckla ditt resonemang." });
  const reviewed = (await getStudentLessonActivities(student.id, courseId, lessonId)).find((row) => row.id === activityId)!.assignmentSubmissions.find((row) => row.id === submitted.id)!;
  assert.equal(reviewed.status, "needs_revision");
  assert.equal(reviewed.feedback, "Utveckla ditt resonemang.");
  assert.equal(reviewed.reviewedBy, admin.id);
  assert.ok(reviewed.reviewedAt);
  const replacement = await saveAssignment(student.id, assignmentInput(activityId, "Mitt kompletterade svar", true, 2));
  assert.notEqual(replacement.id, submitted.id);
  await reviewAssignment(admin.id, { submissionId: replacement.id, courseId, lessonId, status: "approved", feedback: "Godkänt." });
  assert.equal((await getCourseActivityResults(admin.id, courseId)).assignmentSubmissions.find((row) => row.id === replacement.id)!.reviewerName, admin.name);
});

test("revoking enrollment rejects new responses while preserving submitted work and existing progress", async () => {
  const activityId = await saveCourseActivity(admin.id, quiz());
  const assignmentId = await saveCourseActivity(admin.id, assignment());
  const attempt = await submitQuiz(student.id, quizInput(activityId));
  const submission = await saveAssignment(student.id, assignmentInput(assignmentId));
  await getDb().prepare("DELETE FROM enrollments WHERE user_id=? AND course_id=?").run(student.id, courseId);
  await assert.rejects(getStudentLessonActivities(student.id, courseId, lessonId), /tillgång/);
  await assert.rejects(submitQuiz(student.id, quizInput(activityId)), /tillgång/);
  await assert.rejects(saveAssignment(student.id, assignmentInput(assignmentId)), /tillgång/);
  const results = await getCourseActivityResults(admin.id, courseId);
  assert.ok(results.quizAttempts.some((row) => row.id === attempt.id));
  assert.ok(results.assignmentSubmissions.some((row) => row.id === submission.id));
  assert.deepEqual(await getCourseProgress(student.id, courseId), [lessonId]);
  await getDb().prepare("INSERT INTO enrollments(user_id,course_id,created_at) VALUES(?,?,?)").run(student.id, courseId, new Date().toISOString());
});
