import { test } from "node:test";
import assert from "node:assert/strict";
import { getLessonVideoSource } from "../src/lib/lesson-video";

test("YouTube variants resolve to the privacy-enhanced embed without legacy hiding parameters", () => {
  for (const value of [
    "https://www.youtube.com/watch?v=GqLEKNelpDo&t=5s",
    "https://youtu.be/GqLEKNelpDo",
    "https://m.youtube.com/watch?v=GqLEKNelpDo",
    "https://www.youtube-nocookie.com/embed/GqLEKNelpDo",
    "https://youtube.com/shorts/GqLEKNelpDo",
  ]) {
    const source = getLessonVideoSource(value)!;
    assert.equal(source.kind, "youtube");
    const url = new URL(source.url);
    assert.equal(url.hostname, "www.youtube-nocookie.com");
    assert.equal(url.pathname, "/embed/GqLEKNelpDo");
    assert.equal(url.searchParams.get("rel"), "0");
    assert.equal(url.searchParams.get("playsinline"), "1");
    assert.equal(url.searchParams.has("modestbranding"), false);
    assert.equal(url.searchParams.has("showinfo"), false);
    assert.equal(url.searchParams.has("autoplay"), false);
  }
});

test("unsafe URLs and invalid YouTube IDs cannot become embedded players", () => {
  for (const value of [null, "", "javascript:alert(1)", "http://youtu.be/GqLEKNelpDo", "https://user:password@youtube.com/watch?v=GqLEKNelpDo", "https://youtube.com/watch?v=invalid"])
    assert.equal(getLessonVideoSource(value), null);
  assert.equal(getLessonVideoSource("https://youtube.com.example.test/watch?v=GqLEKNelpDo")?.kind, "link");
});

test("direct videos retain query parameters and Vimeo remains embedded", () => {
  const value = "https://example.test/lesson.MP4?token=example";
  assert.deepEqual(getLessonVideoSource(value), { kind: "file", url: value });
  assert.deepEqual(getLessonVideoSource("https://vimeo.com/12345678"), { kind: "vimeo", url: "https://player.vimeo.com/video/12345678" });
});
