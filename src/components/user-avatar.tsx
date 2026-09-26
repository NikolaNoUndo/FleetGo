"use client";

import { GradientAvatar } from "@outpacelabs/avatars";

/**
 * Generative avatar (Outpace Studios, MIT): the same email always renders the same
 * gradient, drawn on a canvas in the browser, so nothing is stored or fetched.
 */
export function UserAvatar({ email, size = 28, className }: { email: string; size?: number; className?: string }) {
  return <GradientAvatar seed={email.trim().toLowerCase()} size={size} className={className} />;
}
