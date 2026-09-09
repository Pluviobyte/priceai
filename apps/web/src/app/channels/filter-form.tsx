"use client";

import Form from "next/form";
import type { ReactNode } from "react";

export function ChannelFilterForm({ children, className }: { children: ReactNode; className: string | undefined }) {
  return <Form action="/channels" className={className} scroll={false} onChange={event => {
    // Search text is submitted with Enter or the button; selects apply immediately.
    if (event.target instanceof HTMLSelectElement) event.currentTarget.requestSubmit();
  }}>{children}</Form>;
}
