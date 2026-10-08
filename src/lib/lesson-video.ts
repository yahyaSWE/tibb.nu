export type LessonVideoSource = {
  kind: "youtube" | "vimeo" | "file" | "link";
  url: string;
};

export function getLessonVideoSource(value: string | null | undefined): LessonVideoSource | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
  } catch {
    return null;
  }
  const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"];
  if (youtubeHosts.includes(url.hostname) || url.hostname === "youtu.be") {
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1) :
      url.searchParams.get("v") || (/^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split("/")[2] : null);
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    // Only supported parameters: rel=0 limits recommendations to this channel;
    // YouTube still determines its own branding and outbound links.
    return { kind: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&hl=sv` };
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)) {
    const id = url.pathname.split("/").filter(Boolean).find(part => /^\d+$/.test(part));
    if (id) return { kind: "vimeo", url: `https://player.vimeo.com/video/${id}` };
  }
  return { kind: /\.(mp4|webm|ogg)$/i.test(url.pathname) ? "file" : "link", url: url.href };
}
