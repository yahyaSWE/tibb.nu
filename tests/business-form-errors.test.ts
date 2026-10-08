import { test } from "node:test";
import assert from "node:assert/strict";
import { redirect } from "next/navigation";
import { withBusinessFormErrors } from "../src/lib/business-form-errors";
import { INITIAL_BUSINESS_FORM_STATE } from "../src/lib/business-form-state";

test("a business settings transport failure clears stale success and keeps the current input", async () => {
  const form = new FormData();
  form.set("learningOutcomes", "Current unsaved learning outcomes");
  const wrapped = withBusinessFormErrors(async () => { throw new Error("Fixture connection lost"); });
  const result = await wrapped({ error: null, success: "Previously saved" }, form);
  assert.match(result.error!, /inmatning finns kvar/);
  assert.equal(result.success, null);
  assert.equal(form.get("learningOutcomes"), "Current unsaved learning outcomes");
});

test("business validation results and authentication redirects remain unchanged", async () => {
  const expected = { error: "Invalid organization number", success: null };
  const validation = withBusinessFormErrors(async () => expected);
  assert.equal(await validation(INITIAL_BUSINESS_FORM_STATE, new FormData()), expected);
  const authenticating = withBusinessFormErrors(async () => redirect("/logga-in"));
  await assert.rejects(authenticating(INITIAL_BUSINESS_FORM_STATE, new FormData()), /NEXT_REDIRECT/);
});
