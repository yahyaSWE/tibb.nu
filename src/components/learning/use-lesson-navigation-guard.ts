"use client";

import { useEffect } from "react";
import {
  createLessonNavigationGuard,
  type LessonEditState,
} from "@/lib/lesson-navigation-guard";

let guard: ReturnType<typeof createLessonNavigationGuard> | undefined;

function currentGuard() {
  return (guard ??= createLessonNavigationGuard(window));
}

export function useLessonNavigationGuard(id: string, state: LessonEditState) {
  const { dirty, pending } = state;
  useEffect(() => {
    const registry = currentGuard();
    registry.set(id, { dirty, pending });
    return () => registry.remove(id);
  }, [id, dirty, pending]);
}

export function allowLessonVersionReset(id: string) {
  return currentGuard().allowReset(id);
}
