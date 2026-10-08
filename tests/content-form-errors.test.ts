import { test } from "node:test";
import assert from "node:assert/strict";
import { redirect } from "next/navigation";
import { withContentFormErrors } from "../src/lib/content-form-errors";

test("a content save transport failure retains the client edits instead of replaying stale server fields", async () => {
  const form = new FormData(); form.set("body", "Latest edited body");
  const wrapped = withContentFormErrors<{ body: string }>(async () => { throw new Error("fixture offline failure"); });
  const result = await wrapped({ error: "Old error", values: { body: "Earlier failed body" } }, form);
  assert.match(result.error!, /inmatning finns kvar/);
  assert.equal(result.values, undefined);
  assert.equal(form.get("body"), "Latest edited body");
});
test("content validation results and successful authentication redirects reach the form/router unchanged", async () => {
  const expected = { error: "Duplicate slug", values: { body: "Current body" } };
  const wrapped = withContentFormErrors(async () => expected);
  assert.equal(await wrapped({}, new FormData()), expected);
  const authenticating = withContentFormErrors(async () => redirect("/logga-in"));
  await assert.rejects(authenticating({}, new FormData()), /NEXT_REDIRECT/);
});
