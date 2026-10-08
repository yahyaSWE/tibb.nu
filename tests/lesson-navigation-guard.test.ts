import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLessonNavigationGuard,
  leavesLessonPage,
} from "../src/lib/lesson-navigation-guard";

const lesson = "https://example.test/elevportal/kurser/1/lektioner/2";

function fixture() {
  const document = new EventTarget();
  const browserEvents = new EventTarget();
  const confirmations: string[] = [];
  const alerts: string[] = [];
  const timers: (() => void)[] = [];
  let accept = false;
  const browser = {
    location: { href: lesson },
    document,
    confirm(message: string) {
      confirmations.push(message);
      return accept;
    },
    alert(message: string) {
      alerts.push(message);
    },
    setTimeout(callback: () => void) {
      timers.push(callback);
      return timers.length;
    },
    addEventListener: browserEvents.addEventListener.bind(browserEvents),
    removeEventListener: browserEvents.removeEventListener.bind(browserEvents),
  } as unknown as Window;
  const guard = createLessonNavigationGuard(browser);
  function unload() {
    const event = new Event("beforeunload", { cancelable: true });
    browserEvents.dispatchEvent(event);
    return event;
  }
  function click(
    href = "/elevportal/kurser/1/lektioner/3",
    options: { ctrlKey?: boolean; target?: string; download?: boolean } = {},
  ) {
    const event = new Event("click", { cancelable: true });
    const anchor = {
      href: new URL(href, lesson).href,
      target: options.target || "",
      hasAttribute: (name: string) => name === "download" && !!options.download,
    };
    Object.defineProperties(event, {
      button: { value: 0 },
      ctrlKey: { value: !!options.ctrlKey },
      target: { value: { closest: () => anchor } },
    });
    document.dispatchEvent(event);
    return event;
  }
  function submit(activityForm = false) {
    const event = new Event("submit", { cancelable: true });
    Object.defineProperty(event, "target", {
      value: {
        hasAttribute: (name: string) =>
          name === "data-lesson-activity-form" && activityForm,
      },
    });
    document.dispatchEvent(event);
    return event;
  }
  return {
    guard,
    document,
    confirmations,
    alerts,
    unload,
    click,
    submit,
    accept(value: boolean) { accept = value; },
    finishEvent() { while (timers.length) timers.shift()!(); },
  };
}

test("route comparison keeps fragment links safe but recognizes lesson, query and origin changes", () => {
  assert.equal(leavesLessonPage(lesson, "#uppgift"), false);
  assert.equal(leavesLessonPage(lesson, lesson), false);
  assert.equal(leavesLessonPage(lesson, "/elevportal/kurser/1/lektioner/3"), true);
  assert.equal(leavesLessonPage(lesson, "?view=other"), true);
  assert.equal(leavesLessonPage(lesson, "https://other.test/"), true);
  assert.equal(leavesLessonPage(lesson, "mailto:info@example.test"), false);
  assert.equal(leavesLessonPage(lesson, "tel:1177"), false);
});

test("reload/close warning is installed only while a form is dirty or awaiting acknowledgement", () => {
  const f = fixture();
  assert.equal(f.unload().defaultPrevented, false);
  f.guard.set("student-a:assignment-1", { dirty: true, pending: false });
  assert.equal(f.unload().defaultPrevented, true);
  f.guard.set("student-a:assignment-1", { dirty: false, pending: true });
  assert.equal(f.unload().defaultPrevented, true);
  f.guard.set("student-a:assignment-1", { dirty: false, pending: false });
  assert.equal(f.unload().defaultPrevented, false);
  assert.equal(f.confirmations.length, 0);
  f.guard.dispose();
});

test("cancelled link navigation stops downstream router handlers before they run", () => {
  const f = fixture();
  f.guard.set("student-a:assignment-1", { dirty: true, pending: false });
  let routed = 0;
  f.document.addEventListener("click", () => routed++);
  assert.equal(f.click().defaultPrevented, true);
  assert.equal(routed, 0);
  assert.equal(f.confirmations.length, 1);
  assert.match(f.confirmations[0], /Avbryt.*stanna och spara/);
  f.accept(true);
  assert.equal(f.click().defaultPrevented, false);
  assert.equal(routed, 1);
  // Approving this click cannot accidentally approve a later reload.
  assert.equal(f.unload().defaultPrevented, false);
  f.finishEvent();
  assert.equal(f.unload().defaultPrevented, true);
  f.guard.dispose();
});

test("new tabs, downloads, mail links and section anchors do not discard the current form", () => {
  const f = fixture();
  f.guard.set("student-a:assignment-1", { dirty: true, pending: false });
  assert.equal(f.click("/elevportal", { ctrlKey: true }).defaultPrevented, false);
  assert.equal(f.click("/elevportal", { target: "_blank" }).defaultPrevented, false);
  assert.equal(f.click("/api/uploads/example", { download: true }).defaultPrevented, false);
  assert.equal(f.click("#uppgift").defaultPrevented, false);
  assert.equal(f.click("mailto:info@example.test").defaultPrevented, false);
  assert.equal(f.confirmations.length, 0);
  assert.equal(f.unload().defaultPrevented, true);
  f.guard.dispose();
});

test("one saved assignment does not clear another assignment or user's unsaved flag", () => {
  const f = fixture();
  f.guard.set("student-a:assignment-1", { dirty: true, pending: false });
  f.guard.set("student-a:assignment-2", { dirty: true, pending: false });
  assert.equal(f.click().defaultPrevented, true);
  assert.equal(f.confirmations.length, 1);
  f.guard.set("student-a:assignment-1", { dirty: false, pending: false });
  assert.equal(f.unload().defaultPrevented, true);
  f.guard.remove("student-a:assignment-2");
  assert.equal(f.unload().defaultPrevented, false);
  f.guard.set("student-b:assignment-1", { dirty: true, pending: false });
  assert.equal(f.guard.allowReset("student-a:assignment-1"), true);
  assert.equal(f.unload().defaultPrevented, true);
  f.guard.remove("student-b:assignment-1");
  assert.equal(f.unload().defaultPrevented, false);
  f.guard.dispose();
});

test("lesson completion is blocked before its server mutation while activity saves remain usable", () => {
  const f = fixture();
  f.guard.set("student-a:assignment-1", { dirty: true, pending: false });
  let mutations = 0;
  f.document.addEventListener("submit", () => mutations++);
  assert.equal(f.submit(false).defaultPrevented, true);
  assert.equal(mutations, 0);
  assert.equal(f.submit(true).defaultPrevented, false);
  assert.equal(mutations, 1);
  assert.equal(f.confirmations.length, 1);
  f.accept(true);
  assert.equal(f.submit(false).defaultPrevented, false);
  assert.equal(mutations, 2);
  f.guard.dispose();
});

test("pending writes cannot be discarded; failed writes retain the unsaved warning", () => {
  const f = fixture();
  f.accept(true);
  f.guard.set("student-a:assignment-1", { dirty: true, pending: true });
  assert.equal(f.click().defaultPrevented, true);
  assert.equal(f.submit(false).defaultPrevented, true);
  assert.equal(f.guard.allowReset("student-a:assignment-1"), false);
  assert.equal(f.alerts.length, 3);
  assert.equal(f.confirmations.length, 0);
  assert.equal(f.submit(true).defaultPrevented, false);
  // A failed save acknowledges no text; only pending clears.
  f.guard.set("student-a:assignment-1", { dirty: true, pending: false });
  assert.equal(f.unload().defaultPrevented, true);
  f.accept(false);
  assert.equal(f.guard.allowReset("student-a:assignment-1"), false);
  assert.match(f.confirmations[0], /kopierat eller antecknat/);
  f.guard.dispose();
  assert.equal(f.unload().defaultPrevented, false);
});
