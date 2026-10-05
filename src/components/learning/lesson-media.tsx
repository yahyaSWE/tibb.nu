import { Download, ExternalLink } from "lucide-react";

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
  const url = httpsUrl(value);
  if (!url) return null;
  let embedUrl: string | null = null;
  let youtubeId: string | null = null;
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
  )
    youtubeId =
      url.searchParams.get("v") ||
      (url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : null);
  if (url.hostname === "youtu.be") youtubeId = url.pathname.slice(1);
  if (youtubeId && /^[\w-]{11}$/.test(youtubeId))
    embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}`;
  if (
    ["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)
  ) {
    const id = url.pathname
      .split("/")
      .filter(Boolean)
      .find((part) => /^\d+$/.test(part));
    if (id) embedUrl = `https://player.vimeo.com/video/${id}`;
  }
  if (embedUrl)
    return (
      <div className="lesson-video">
        <iframe
          src={embedUrl}
          title="Lektionens video"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname))
    return (
      <div className="lesson-video">
        <video controls preload="metadata" src={url.href}>
          Din webbläsare kan inte spela videon.{" "}
          <a href={url.href}>Öppna videon</a>
        </video>
      </div>
    );
  return (
    <a
      className="button button-secondary lesson-media-link"
      href={url.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      Öppna lektionens video <ExternalLink size={17} />
    </a>
  );
}

export function LessonMaterial({
  url: value,
}: {
  url: string | null | undefined;
}) {
  const url = httpsUrl(value);
  if (!url) return null;
  return (
    <a
      className="lesson-material panel"
      href={url.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Download size={22} />
      <span>
        <strong>Lektionsmaterial</strong>
        <small className="muted">Öppna kursens tillhörande material</small>
      </span>
      <ExternalLink size={17} />
    </a>
  );
}
