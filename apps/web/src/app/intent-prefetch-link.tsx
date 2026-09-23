"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * Prefetches only once the visitor shows intent: pointer over, keyboard focus or touch. This is the
 * Next.js hover-triggered prefetch pattern, extended to focus and touch. Use it for links to heavy
 * dynamic pages; prefetching every such link a visitor merely scrolls past once exhausted the database
 * pool. `null` restores the default prefetch, which for a dynamic route stops at its loading.tsx.
 */
export function IntentPrefetchLink({ onMouseEnter, onFocus, onTouchStart, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={intent ? null : false}
    onMouseEnter={event => { setIntent(true); onMouseEnter?.(event); }}
    onFocus={event => { setIntent(true); onFocus?.(event); }}
    onTouchStart={event => { setIntent(true); onTouchStart?.(event); }} />;
}
