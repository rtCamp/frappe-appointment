import { useEffect, useState } from "react";

/** Copy text and remember which key was copied for a moment, to show "Copied" next to it. */
export const useCopied = () => {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      // Clipboard blocked: the link is still on screen to copy by hand.
    }
  };
  return { copied, copy };
};
