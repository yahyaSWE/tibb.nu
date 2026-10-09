import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createLatestRequest, type LatestRequestState } from "../src/components/shop/latest-request";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("quote debounce sends only the latest postcode, coupon and quantity combination", async () => {
  const sent: string[] = [];
  const states: LatestRequestState<number>[] = [];
  const controller = createLatestRequest(async (input: string) => { sent.push(input); return 1000; }, (state) => states.push(state), 10);
  controller.start("one", "postcode one");
  controller.start("two", "coupon two");
  controller.start("three", "quantity three");
  await delay(30);
  assert.deepEqual(sent, ["quantity three"]);
  assert.deepEqual(states.at(-1), { key: "three", status: "success", value: 1000 });
  controller.dispose();
});

test("a slower previous quote cannot replace the latest price even when transport ignores abort", async () => {
  const first = deferred<number>();
  const second = deferred<number>();
  const signals: AbortSignal[] = [];
  const states: LatestRequestState<number>[] = [];
  const controller = createLatestRequest((input: string, signal) => { signals.push(signal); return input === "old" ? first.promise : second.promise; }, (state) => states.push(state), 0);
  controller.start("old-key", "old");
  await delay(5);
  controller.start("new-key", "new");
  assert.equal(signals[0].aborted, true);
  await delay(5);
  second.resolve(2200);
  await delay(0);
  first.resolve(9900);
  await delay(0);
  assert.deepEqual(states.at(-1), { key: "new-key", status: "success", value: 2200 });
  assert.equal(states.some((state) => state.status === "success" && state.key === "old-key"), false);
  controller.dispose();
});

test("a delayed previous failure does not erase a newly successful quote", async () => {
  const first = deferred<number>();
  const states: LatestRequestState<number>[] = [];
  const controller = createLatestRequest((input: string) => input === "old" ? first.promise : Promise.resolve(1500), (state) => states.push(state), 0);
  controller.start("old", "old");
  await delay(5);
  controller.start("new", "new");
  await delay(5);
  first.reject(new Error("network failure"));
  await delay(0);
  assert.deepEqual(states.at(-1), { key: "new", status: "success", value: 1500 });
  controller.dispose();
});

test("cancel and unmount prevent a late quote from making a changed or closed checkout ready", async () => {
  const response = deferred<number>();
  const states: LatestRequestState<number>[] = [];
  const controller = createLatestRequest(() => response.promise, (state) => states.push(state), 0);
  controller.start("cart", "cart");
  await delay(5);
  controller.cancel();
  response.resolve(1000);
  await delay(0);
  assert.deepEqual(states, [{ key: "cart", status: "pending" }]);
  controller.dispose();
  controller.start("another", "another");
  await delay(5);
  assert.equal(states.length, 1);
});

test("a current network failure exposes a retry state rather than an old confirmed total", async () => {
  const failure = new Error("unavailable");
  const states: LatestRequestState<number>[] = [];
  const controller = createLatestRequest(async () => { throw failure; }, (state) => states.push(state), 0);
  controller.start("current", "current");
  await delay(5);
  assert.deepEqual(states.at(-1), { key: "current", status: "error", error: failure });
  controller.dispose();
});
