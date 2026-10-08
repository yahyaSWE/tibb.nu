"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { withContentFormErrors } from "./content-form-errors";
import type { ContentActionState } from "./content-action-state";

export function useContentForm<Values>(
  saveAction: (
    previous: ContentActionState<Values>,
    form: FormData,
  ) => Promise<ContentActionState<Values>>,
  initialValues: Values,
  formKey: string,
  resetAfterSave = false,
) {
  const [state, action, pending] = useActionState(withContentFormErrors(saveAction), {});
  const [values, setValues] = useState(state.values ?? initialValues);
  const [showError, setShowError] = useState(Boolean(state.error));
  const errorRef = useRef<HTMLDivElement>(null);
  const defaults = useRef(initialValues);
  defaults.current = initialValues;
  const search = useSearchParams();
  const savedToken = search.get("saved");
  const savedForm = search.get("savedForm");
  const [resetToken, setResetToken] = useState(savedToken);
  const previousSaved = useRef(savedToken);

  useEffect(() => {
    if (!state.error) return;
    if (state.values) setValues(state.values);
    setShowError(true);
  }, [state]);

  useEffect(() => {
    if (showError && state.error) errorRef.current?.focus();
  }, [showError, state]);

  useEffect(() => {
    if (
      savedToken &&
      savedToken !== previousSaved.current &&
      savedForm === formKey
    ) {
      setShowError(false);
      if (resetAfterSave) {
        setValues(defaults.current);
        setResetToken(savedToken);
      }
    }
    previousSaved.current = savedToken;
  }, [savedToken, savedForm, formKey, resetAfterSave]);

  return {
    action,
    pending,
    values,
    setValues,
    errorRef,
    error: showError ? state.error : undefined,
    onSubmit: () => setShowError(false),
    savedToken: resetToken,
  };
}
