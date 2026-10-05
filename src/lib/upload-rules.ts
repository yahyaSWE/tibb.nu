export type UploadKind = "practitioner-photo" | "lesson-material";
export const UPLOAD_LIMITS = {
  "practitioner-photo": 2 * 1024 * 1024,
  "lesson-material": 20 * 1024 * 1024,
};
export const MAX_LESSON_FILES = 20;
export const UPLOAD_ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const UPLOAD_FORMATS = {
  "practitioner-photo": {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  },
  "lesson-material": {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
} as const;
export const UPLOAD_ACCEPT = {
  "practitioner-photo": ".jpg,.jpeg,.png,.webp",
  "lesson-material": ".pdf,.doc,.docx",
};
export function fileSizeLabel(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.ceil(size / 1024))} kB`;
}
export function uploadContentType(
  kind: UploadKind,
  filename: string,
): string | undefined {
  const extension = filename.split(".").at(-1)?.toLowerCase() || "";
  const formats: Record<string, string> = UPLOAD_FORMATS[kind];
  return formats[extension];
}
