export type LessonEditState = {
  dirty: boolean;
  pending: boolean;
};

export function leavesLessonPage(currentHref: string, destination: string) {
  try {
    const current = new URL(currentHref);
    const next = new URL(destination, current);
    if (next.protocol !== "http:" && next.protocol !== "https:") return false;
    return (
      current.origin !== next.origin ||
      current.pathname !== next.pathname ||
      current.search !== next.search
    );
  } catch {
    return false;
  }
}

export function lessonExitState(states: Iterable<LessonEditState>) {
  let dirty = false;
  let pending = false;
  for (const state of states) {
    dirty ||= state.dirty;
    pending ||= state.pending;
  }
  return { dirty, pending };
}

// This registry stores only editing flags, never a student's answer text.
// All listeners disappear as soon as the last active form is saved/unmounted.
export function createLessonNavigationGuard(browser: Window) {
  const entries = new Map<string, LessonEditState>();
  let installed = false;
  let approvedUntilEndOfEvent = false;

  function allowExit(states: Iterable<LessonEditState>, reset = false) {
    const { dirty, pending } = lessonExitState(states);
    if (pending) {
      browser.alert(
        "Ett svar håller på att sparas eller rättas. Vänta tills det är klart innan du går vidare.",
      );
      return false;
    }
    if (!dirty) return true;
    return browser.confirm(
      reset
        ? "Dina osparade svar försvinner när du öppnar den nya versionen. Har du kopierat eller antecknat det du vill behålla?"
        : "Du har osparade svar i lektionen. Välj Avbryt för att stanna och spara. Vill du lämna utan att spara?",
    );
  }

  function approveThisEvent() {
    approvedUntilEndOfEvent = true;
    browser.setTimeout(() => {
      approvedUntilEndOfEvent = false;
    }, 0);
  }

  function stop(event: Event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    const { dirty, pending } = lessonExitState(entries.values());
    if (approvedUntilEndOfEvent || (!dirty && !pending)) return;
    event.preventDefault();
    event.returnValue = true;
  }

  function click(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;
    const target = event.target as Element | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (
      !anchor ||
      (anchor.target && anchor.target !== "_self") ||
      anchor.hasAttribute("download") ||
      !leavesLessonPage(browser.location.href, anchor.href)
    ) return;
    if (!allowExit(entries.values())) stop(event);
    else approveThisEvent();
  }

  function submit(event: SubmitEvent) {
    if (event.defaultPrevented) return;
    const form = event.target as HTMLFormElement | null;
    // These actions stay in the lesson and keep the other controlled forms.
    // Completion/logout/other forms must be checked BEFORE their mutation runs.
    if (form?.hasAttribute?.("data-lesson-activity-form")) return;
    if (!allowExit(entries.values())) stop(event);
    else approveThisEvent();
  }

  function install() {
    if (installed) return;
    installed = true;
    browser.addEventListener("beforeunload", beforeUnload);
    browser.document.addEventListener("click", click, true);
    browser.document.addEventListener("submit", submit, true);
  }

  function uninstall() {
    if (!installed) return;
    installed = false;
    browser.removeEventListener("beforeunload", beforeUnload);
    browser.document.removeEventListener("click", click, true);
    browser.document.removeEventListener("submit", submit, true);
    approvedUntilEndOfEvent = false;
  }

  return {
    set(id: string, state: LessonEditState) {
      if (state.dirty || state.pending) entries.set(id, state);
      else entries.delete(id);
      if (entries.size) install();
      else uninstall();
    },
    remove(id: string) {
      entries.delete(id);
      if (!entries.size) uninstall();
    },
    allowReset(id: string) {
      const state = entries.get(id);
      return !state || allowExit([state], true);
    },
    dispose() {
      entries.clear();
      uninstall();
    },
  };
}
