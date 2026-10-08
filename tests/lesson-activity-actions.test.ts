import assert from "node:assert/strict";
import { test } from "node:test";
import { withLessonActivityErrors } from "../src/lib/lesson-activity-actions";

test("a successful or rejected domain save keeps its real state and unchanged form identity", async () => {
  const form = new FormData();
  form.set("activityId", "17");
  form.set("courseId", "4");
  form.set("lessonId", "8");
  form.set("revision", "2");
  form.set("text", "Private fixture answer");
  form.set("intent", "draft");
  const previous = { error: "Ett tidigare fel" };
  const result = { success: "Ditt utkast har sparats." };
  const safe = withLessonActivityErrors(async (received, payload) => {
    assert.strictEqual(received, previous);
    assert.strictEqual(payload, form);
    return result;
  });
  assert.strictEqual(await safe(previous, form), result);
  assert.equal(form.get("text"), "Private fixture answer");
  const conflict = { error: "Aktiviteten har uppdaterats. Ladda den nya versionen." };
  const rejected = withLessonActivityErrors(async () => conflict);
  assert.strictEqual(await rejected({}, form), conflict);
  assert.equal(form.get("revision"), "2");
});

test("network failure becomes a retryable inline error without revealing or clearing an answer", async () => {
  const form = new FormData();
  form.set("text", "Private transport-test answer");
  const safe = withLessonActivityErrors(async () => {
    throw new TypeError("Failed to fetch: secret diagnostic detail");
  });
  const state = await safe({}, form);
  assert.match(state.error!, /finns kvar i formuläret/);
  assert.match(state.error!, /Kontrollera anslutningen/);
  assert.ok(!state.success);
  assert.ok(!JSON.stringify(state).includes("Private transport-test answer"));
  assert.ok(!JSON.stringify(state).includes("secret diagnostic detail"));
  assert.equal(form.get("text"), "Private transport-test answer");
});

test("authentication redirects and not-found control flow still reach the Next router", async () => {
  for (const digest of [
    "NEXT_REDIRECT;replace;/logga-in;307;",
    "NEXT_HTTP_ERROR_FALLBACK;404",
  ]) {
    const redirect = Object.assign(new Error("Next control flow"), { digest });
    const safe = withLessonActivityErrors(async () => { throw redirect; });
    await assert.rejects(() => safe({}, new FormData()), (error) => error === redirect);
  }
});

test("a wrapped redirect cause is not swallowed as a transport error", async () => {
  const redirect = Object.assign(new Error("Next redirect"), {
    digest: "NEXT_REDIRECT;replace;/logga-in;307;",
  });
  const safe = withLessonActivityErrors(async () => {
    throw new Error("Wrapped", { cause: redirect });
  });
  await assert.rejects(() => safe({}, new FormData()), (error) => error === redirect);
});
