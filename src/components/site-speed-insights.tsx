"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

export function SiteSpeedInsights() {
  return (
    <SpeedInsights
      beforeSend={(event) => {
        const url = new URL(event.url);

        if (/^\/(admin|anamnes|elevportal)(\/|$)/.test(url.pathname)) {
          return null;
        }

        // Links for email verification and password resets carry tokens in the query string.
        return { ...event, url: `${url.origin}${url.pathname}` };
      }}
    />
  );
}
