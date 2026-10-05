"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadPresigned } from "@vercel/blob/client";
import { FileText, ImagePlus, LoaderCircle, X } from "lucide-react";
import type { UploadedMaterial } from "@/lib/types";
import {
  fileSizeLabel,
  MAX_LESSON_FILES,
  UPLOAD_ACCEPT,
  UPLOAD_LIMITS,
  uploadContentType,
  type UploadKind,
} from "@/lib/upload-rules";
import "./file-upload.css";

async function jsonResponse(response: Response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Uppladdningen kunde inte slutföras. Försök igen.");
  }
  if (!response.ok)
    throw new Error(body.error || "Uppladdningen kunde inte slutföras.");
  return body;
}
export function FileUpload({
  kind,
  inputName,
  currentFiles,
  multiple = false,
  courseId,
}: {
  kind: UploadKind;
  inputName: string;
  currentFiles: UploadedMaterial[];
  multiple?: boolean;
  courseId?: number;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(currentFiles);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const { pending } = useFormStatus();
  const photo = kind === "practitioner-photo";
  useEffect(() => {
    const form = container.current?.closest("form");
    if (!form) return;
    form.toggleAttribute("data-upload-busy", busy);
    form.dispatchEvent(new Event("tibb-upload-state"));
    const preventSubmit = (event: Event) => {
      if (busy) {
        event.preventDefault();
        setError("Vänta tills filen har laddats upp innan du sparar.");
      }
    };
    form.addEventListener("submit", preventSubmit, true);
    return () => {
      form.removeEventListener("submit", preventSubmit, true);
      form.removeAttribute("data-upload-busy");
      form.dispatchEvent(new Event("tibb-upload-state"));
    };
  }, [busy]);
  async function uploadFiles(selected: File[]) {
    setError("");
    if (!selected.length) return;
    if (multiple && files.length + selected.length > MAX_LESSON_FILES) {
      setError("En lektion kan ha högst 20 filer.");
      return;
    }
    for (const file of selected) {
      if (!uploadContentType(kind, file.name)) {
        setError(
          photo
            ? "Välj en JPG-, PNG- eller WebP-bild."
            : "Välj PDF- eller Word-filer (.doc eller .docx).",
        );
        return;
      }
      if (!file.size || file.size > UPLOAD_LIMITS[kind]) {
        setError(
          photo
            ? "Bilden får vara högst 2 MB."
            : "Varje fil får vara högst 20 MB.",
        );
        return;
      }
    }
    setBusy(true);
    try {
      for (let index = 0; index < selected.length; index++) {
        const file = selected[index];
        const label =
          selected.length > 1 ? `Fil ${index + 1} av ${selected.length}: ` : "";
        setProgress(`${label}Förbereder ${file.name}…`);
        const prepared = await jsonResponse(
          await fetch("/api/uploads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind,
              filename: file.name,
              size: file.size,
              courseId,
            }),
          }),
        );
        if (prepared.provider === "blob") {
          await uploadPresigned(prepared.pathname, file, {
            access: "private",
            contentType: prepared.contentType,
            handleUploadUrl: "/api/uploads/blob",
            clientPayload: JSON.stringify({ id: prepared.id }),
            onUploadProgress: ({ percentage }) =>
              setProgress(`${label}${file.name} · ${Math.round(percentage)} %`),
          });
        }
        setProgress(`${label}Sparar ${file.name}…`);
        const response = await fetch(
          `/api/uploads/${prepared.id}/complete`,
          prepared.provider === "local"
            ? {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream" },
                body: file,
              }
            : { method: "POST" },
        );
        const asset = (await jsonResponse(response)) as UploadedMaterial;
        setFiles((current) => (multiple ? [...current, asset] : [asset]));
      }
      setProgress(
        selected.length > 1
          ? "Filerna är uppladdade. Spara lektionen för att lägga till dem."
          : photo
            ? "Bilden är uppladdad. Spara behandlaren för att visa den."
            : "Filen är uppladdad. Spara lektionen för att lägga till den.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Filen kunde inte laddas upp.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div
      className={`file-upload ${photo ? "file-upload-photo" : ""}`}
      ref={container}
    >
      {multiple && (
        <input type="hidden" name={`${inputName}Present`} value="1" />
      )}
      {files.map((file) => (
        <input key={file.id} type="hidden" name={inputName} value={file.id} />
      ))}
      {!multiple && !files.length && (
        <input type="hidden" name={inputName} value="" />
      )}
      <div className="uploaded-file-list">
        {files.map((file) => (
          <div className="uploaded-file" key={file.id}>
            {photo ? (
              <img
                className="uploaded-file-photo"
                src={file.url}
                alt="Förhandsvisning av behandlarbild"
                width={72}
                height={72}
              />
            ) : (
              <FileText size={24} aria-hidden="true" />
            )}
            <div className="uploaded-file-copy">
              <a href={file.url} target="_blank" rel="noopener noreferrer">
                {file.name}
              </a>
              <small>{fileSizeLabel(file.size)}</small>
            </div>
            <button
              type="button"
              disabled={busy || pending}
              className="uploaded-file-remove"
              aria-label={`Ta bort ${file.name}`}
              onClick={() => {
                setFiles((current) =>
                  current.filter((item) => item.id !== file.id),
                );
                setProgress(
                  photo
                    ? "Bilden tas bort när du sparar behandlaren."
                    : "Filen tas bort från lektionen när du sparar.",
                );
              }}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <label className="upload-input-label" htmlFor={id}>
        {photo ? (
          <ImagePlus size={18} aria-hidden="true" />
        ) : (
          <FileText size={18} aria-hidden="true" />
        )}
        {photo
          ? files.length
            ? "Byt bild"
            : "Välj bild"
          : "Ladda upp PDF eller Word"}
      </label>
      <input
        id={id}
        ref={input}
        className="upload-file-input"
        type="file"
        accept={UPLOAD_ACCEPT[kind]}
        multiple={multiple}
        disabled={busy || pending}
        onChange={(event) => void uploadFiles([...(event.target.files || [])])}
      />
      <p className="upload-help">
        {photo
          ? "JPG, PNG eller WebP · högst 2 MB. Bilden är valfri."
          : "PDF, DOC eller DOCX · högst 20 MB per fil. Du kan välja flera filer samtidigt."}
      </p>
      {progress && (
        <p className="upload-progress" role="status">
          {busy && (
            <LoaderCircle
              className="admin-submit-spinner"
              size={15}
              aria-hidden="true"
            />
          )}
          {progress}
        </p>
      )}
      {error && (
        <p className="upload-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
