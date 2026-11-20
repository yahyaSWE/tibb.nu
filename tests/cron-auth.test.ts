import assert from "node:assert/strict";
import { test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { canRunEmailOutbox } from "../src/lib/cron-auth";

test("the production outbox trusts only signed tokens for its scheduled workflow", async (t) => {
  const issuer = "https://token.actions.githubusercontent.com";
  const audience = "https://www.tibb.nu/api/email/outbox";
  const claims = {
    repository_id: "1405480764",
    ref: "refs/heads/main",
    workflow_ref: "yahyaSWE/tibb.nu/.github/workflows/email-outbox.yml@refs/heads/main",
    event_name: "schedule",
  };
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const { privateKey: otherKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256" };
  const fetch = t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, `${issuer}/.well-known/jwks`);
    return Response.json({ keys: [jwk] });
  });
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  try {
    const makeToken = (overrides = {}, key = privateKey, expiry = "5 minutes") =>
      new SignJWT({ ...claims, ...overrides }).setProtectedHeader({ alg: "RS256", kid: jwk.kid })
        .setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiry).sign(key);
    const authorize = (token: string) => canRunEmailOutbox(new Request(audience, { headers: { authorization: `Bearer ${token}` } }));
    assert.equal(await authorize(await makeToken({ ref: "refs/heads/other" })), false);
    assert.equal(await authorize(await makeToken({ event_name: "pull_request" })), false);
    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(await authorize(await makeToken({}, otherKey)), false);
    assert.equal(await authorize(await makeToken({}, privateKey, "1 minute ago")), false);
    assert.equal(await authorize(await makeToken()), true);
    const manual = await makeToken({ event_name: "workflow_dispatch" });
    assert.equal(await authorize(manual), true);
    process.env.VERCEL_ENV = "preview";
    assert.equal(await authorize(manual), false);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});
