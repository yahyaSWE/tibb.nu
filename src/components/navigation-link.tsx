"use client";

import Link, { useLinkStatus } from "next/link";
import { useState, type ComponentProps } from "react";
import "./navigation.css";

function NavigationHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`navigation-link-hint${pending ? " is-pending" : ""}`}
      aria-hidden="true"
    />
  );
}

// Keep Next's navigation, scheduling and cache invalidation. Secondary menus
// only warm their loading boundary after hover, keyboard focus or touch.
export function NavigationLink({
  intentOnly = false,
  className,
  children,
  prefetch,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: ComponentProps<typeof Link> & { intentOnly?: boolean }) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      className={`navigation-link${className ? ` ${className}` : ""}`}
      prefetch={
        prefetch !== undefined ? prefetch : intentOnly && !intent ? false : null
      }
      onMouseEnter={(event) => {
        if (intentOnly) setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        if (intentOnly) setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        if (intentOnly) setIntent(true);
        onTouchStart?.(event);
      }}
    >
      {children}
      <NavigationHint />
    </Link>
  );
}
