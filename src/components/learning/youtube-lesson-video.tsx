"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import styles from "./youtube-lesson-video.module.css";

export function YouTubeLessonVideo({ src }: { src: string }) {
  const [started, setStarted] = useState(false);
  const player = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (started) player.current?.focus();
  }, [started]);
  return (
    <div className="lesson-video">
      {started ? (
        <iframe
          ref={player}
          src={`${src}&autoplay=1`}
          title="Lektionens video"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className={styles.start} onClick={() => setStarted(true)} aria-label="Spela lektionens video">
          <span className={styles.play}><Play size={30} aria-hidden="true" /></span>
          <strong>Spela video</strong>
          <span className={styles.caption}>Videolektion</span>
        </button>
      )}
    </div>
  );
}
