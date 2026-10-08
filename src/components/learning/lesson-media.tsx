import { Download, ExternalLink } from "lucide-react";
import type { UploadedMaterial } from "@/lib/types";
import { fileSizeLabel, UPLOAD_ID } from "@/lib/upload-rules";
import { getLessonVideoSource } from "@/lib/lesson-video";
import { YouTubeLessonVideo } from "./youtube-lesson-video";

function httpsUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

export function LessonVideo({
  url: value,
}: {
  url: string | null | undefined;
}) {
  const source = getLessonVideoSource(value);
  if (!source) return null;
  if (source.kind === "youtube")
    return <YouTubeLessonVideo key={source.url} src={source.url} />;
  if (source.kind === "vimeo")
    return (
      <div className="lesson-video">
        <iframe
          src={source.url}
          title="Lektionens video"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  if (source.kind === "file")
    return (
      <div className="lesson-video">
        <video controls preload="metadata" playsInline src={source.url}>
          Din webbläsare kan inte spela videon.{" "}
          <a href={source.url}>Öppna videon</a>
        </video>
      </div>
    );
  return (
    <a
      className="button button-secondary lesson-media-link"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Öppna lektionens video <ExternalLink size={17} />
    </a>
  );
}

export function LessonMaterial({
  url: value,
  files = [],
}: {
  url: string | null | undefined;
  files?: UploadedMaterial[];
}) {
  const url = httpsUrl(value);
  const uploaded = files.filter(
    (file) => UPLOAD_ID.test(file.id) && file.url === `/api/uploads/${file.id}`,
  );
  if (!url && !uploaded.length) return null;
  return (
    <>
      {uploaded.length > 0 && (
        <section aria-label="Lektionsmaterial">
          <h2>Lektionsmaterial</h2>
          {uploaded.map((file) => (
            <a
              key={file.id}
              className="lesson-material panel"
              href={file.url}
              download={file.name}
              aria-label={`Ladda ner ${file.name}`}
            >
              <Download size={22} aria-hidden="true" />
              <span style={{ minWidth: 0 }}>
                <strong style={{ overflowWrap: "anywhere" }}>
                  {file.name}
                </strong>
                <small className="muted">
                  {materialType(file)} · {fileSizeLabel(file.size)} · Ladda ner
                </small>
              </span>
            </a>
          ))}
        </section>
      )}
      {url && (
        <a
          className="lesson-material panel"
          href={url.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download size={22} aria-hidden="true" />
          <span>
            <strong>
              {uploaded.length
                ? "Ytterligare kursmaterial"
                : "Lektionsmaterial"}
            </strong>
            <small className="muted">Öppna kursens tillhörande material</small>
          </span>
          <ExternalLink size={17} aria-hidden="true" />
        </a>
      )}
    </>
  );
}

function materialType(file: UploadedMaterial) {
  if (file.contentType === "application/pdf") return "PDF";
  if (file.contentType === "application/msword") return "Word (.doc)";
  if (
    file.contentType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "Word (.docx)";
  return "Dokument";
}
