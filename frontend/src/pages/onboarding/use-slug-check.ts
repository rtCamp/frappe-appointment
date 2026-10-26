/**
 * Checks a booking link (slug) as it's typed: the server's pattern, then whether someone else has it.
 */
import { useContext, useEffect, useState } from "react";
import { FrappeConfig, FrappeContext } from "frappe-react-sdk";

import { IS_SLUG_AVAILABLE, SLUG_PATTERN } from "./api";

export type SlugState = "same" | "checking" | "available" | "taken" | "invalid" | "empty";

export const useSlugCheck = (slug: string, savedSlug: string) => {
  const { call } = useContext(FrappeContext) as FrappeConfig;
  const [slugState, setSlugState] = useState<SlugState>("checking");
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Check the link as it's typed. The server counts the user's own saved link as taken, so skip that one.
  useEffect(() => {
    const value = slug.trim();
    if (!value) return setSlugState("empty");
    if (!SLUG_PATTERN.test(value)) return setSlugState("invalid");
    if (value === savedSlug) return setSlugState("same");
    setSlugState("checking");
    let stale = false;
    const id = window.setTimeout(async () => {
      try {
        const { message } = await call.get(IS_SLUG_AVAILABLE, { slug: value });
        if (stale) return;
        setSuggestion(message.suggested_slug ?? null);
        setSlugState(message.is_available ? "available" : "taken");
      } catch {
        if (!stale) setSlugState("available");
      }
    }, 400);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
  }, [slug, savedSlug, call]);

  return { state: slugState, suggestion, ok: slugState === "same" || slugState === "available" };
};

export type SlugCheck = ReturnType<typeof useSlugCheck>;
