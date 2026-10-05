"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function SubmitButton({
  children,
  className = "button button-primary",
  pendingLabel = "Sparar…",
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => setUploading(form.hasAttribute("data-upload-busy"));
    form.addEventListener("tibb-upload-state", update);
    update();
    return () => form.removeEventListener("tibb-upload-state", update);
  }, []);
  return (
    <button
      ref={ref}
      type="submit"
      className={className}
      disabled={pending || uploading}
    >
      {pending || uploading ? (
        <>
          <LoaderCircle
            className="admin-submit-spinner"
            size={16}
            aria-hidden="true"
          />
          {uploading ? "Laddar upp…" : pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
