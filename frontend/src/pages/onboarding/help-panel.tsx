/**
 * Help: the tips, in a small panel beside the sidebar. The page stays usable while it's open, so it only closes
 * from its own button, the sidebar's Help button or Escape. A tip can play a motion: a short animation of the task,
 * which also opens enlarged.
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, ChevronDown, Lightbulb, Play, X } from "lucide-react";

import MotionPlayer from "@/components/motion-player";
import { cn } from "@/lib/utils";
import { HelpDestination, HelpTip } from "./help";
import { Button } from "./ui";

const OPEN_MS = 200;

/** Opens and closes its content by height. The content is only there while it's open or closing. */
const Collapse = ({ open, id, children }: { open: boolean; id: string; children: ReactNode }) => {
  const [present, setPresent] = useState(open);
  const [tall, setTall] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      // A frame after the content is there, so the height has somewhere to grow from.
      let second = 0;
      const first = requestAnimationFrame(() => (second = requestAnimationFrame(() => setTall(true))));
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setTall(false);
    const gone = window.setTimeout(() => setPresent(false), OPEN_MS);
    return () => window.clearTimeout(gone);
  }, [open]);

  return (
    <div
      id={id}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none",
        tall ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="min-h-0 overflow-hidden">{present && children}</div>
    </div>
  );
};

/** A tip's motion under its text, and the same motion enlarged over the page. */
const TipMotion = ({ motion, title }: { motion: NonNullable<HelpTip["motion"]>; title: string }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <MotionPlayer load={motion} label={title} paused={expanded} onExpand={() => setExpanded(true)} />
      <DialogPrimitive.Root open={expanded} onOpenChange={setExpanded}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md animate-in fade-in-0 duration-100 motion-reduce:animate-none" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            // "espresso" brings the colour tokens: this is rendered outside the page's frame.
            className="espresso font-espresso fixed left-1/2 top-1/2 z-50 flex w-[min(calc(100%_-_4rem),calc((100dvh_-_10rem)_*_16_/_9))] max-w-7xl -translate-x-1/2 -translate-y-1/2 flex-col gap-6 rounded-xl bg-surface-elevation-2 px-4 pb-6 pt-5 text-ink-gray-8 shadow-es-2xl outline-none sm:px-6"
          >
            <div className="flex items-center justify-between gap-2">
              <DialogPrimitive.Title className="m-0 text-2xl font-semibold leading-6 text-ink-gray-9">{title}</DialogPrimitive.Title>
              <Button variant="ghost" className="w-7 px-0" aria-label="Close" onClick={() => setExpanded(false)}>
                <X className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
            <MotionPlayer load={motion} label={title} onCollapse={() => setExpanded(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

const TipList = ({
  label,
  tips,
  open,
  onToggle,
  section,
  onGo,
}: {
  label: string;
  tips: HelpTip[];
  open: string | null;
  onToggle: (id: string) => void;
  section?: string;
  onGo?: (to: HelpDestination) => void;
}) => {
  if (!tips.length) return null;
  // A link to the page that's already open goes nowhere.
  const linksOf = (tip: HelpTip) =>
    onGo ? (tip.links ?? []).filter(({ to }) => !("section" in to) || to.section !== section) : [];
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 px-2 pt-2 text-es-xs font-medium text-ink-gray-5">{label}</p>
      {tips.map((tip) => {
        const expanded = open === tip.id;
        const Icon = tip.motion ? Play : Lightbulb;
        const links = linksOf(tip);
        return (
          <div key={tip.id}>
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`help-${tip.id}`}
                onClick={() => onToggle(tip.id)}
                className="flex w-full items-center gap-2 rounded-md border-0 bg-transparent p-2 text-left text-es-sm font-[420] text-ink-gray-8 cursor-pointer hover:bg-surface-gray-2 focus-visible:outline-none focus-visible:shadow-es-focus"
              >
                <Icon className="size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
                <span className="flex-1">{tip.title}</span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-ink-gray-4 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <Collapse open={expanded} id={`help-${tip.id}`}>
              <div className="flex flex-col gap-2 pb-3 pl-8 pr-2 pt-1 text-es-sm leading-relaxed text-ink-gray-6">
                <p className="m-0">{tip.body}</p>
                {tip.steps && (
                  <ol className="m-0 list-decimal space-y-1 pl-4 marker:text-ink-gray-5">
                    {tip.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
                {tip.points && (
                  <ul className="m-0 list-disc space-y-1 pl-4 marker:text-ink-gray-5">
                    {tip.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
                {links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {links.map((link) => (
                      <Button key={link.label} variant="subtle" onClick={() => onGo?.(link.to)}>
                        {link.label}
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    ))}
                  </div>
                )}
                {tip.motion && <TipMotion motion={tip.motion} title={tip.title} />}
              </div>
            </Collapse>
          </div>
        );
      })}
    </div>
  );
};

const HelpPanel = ({
  tips,
  section,
  onGo,
  onClose,
}: {
  tips: HelpTip[];
  /** The sidebar section that's open, whose tips come first. */
  section?: string;
  /** Follows a tip's link. Without it, tips show no links, e.g. before the app's sections and Settings are there. */
  onGo?: (to: HelpDestination) => void;
  onClose: () => void;
}) => {
  const [open, setOpen] = useState<string | null>(null);
  // Radix only gives focus back to a Dialog.Trigger, and this opens from the sidebar's button.
  const returnFocusTo = useRef(document.activeElement as HTMLElement | null);

  // Tips with a motion come first in each list.
  const sorted = [...tips].sort((a, b) => Number(!a.motion) - Number(!b.motion));
  const here = sorted.filter((tip) => section && tip.section === section);
  const rest = sorted.filter((tip) => !here.includes(tip));
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));

  return (
    <DialogPrimitive.Root open modal={false} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Content
        aria-describedby={undefined}
        // Stays open while the page is used.
        onInteractOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (returnFocusTo.current?.isConnected) returnFocusTo.current.focus();
        }}
        // "espresso" brings the colour tokens: the panel sits outside the page's frame. The sidebar is 224px wide
        // until the page is too narrow for it (784px), where it moves above the page and the panel spans the screen.
        className={cn(
          "espresso font-espresso fixed z-30 bottom-4 left-[232px] w-[360px] max-w-[calc(100vw-248px)] max-h-[calc(100vh-2rem)] origin-bottom-left",
          "max-[783px]:left-2 max-[783px]:right-2 max-[783px]:bottom-2 max-[783px]:w-auto max-[783px]:max-w-none max-[783px]:max-h-[calc(100vh-1rem)]",
          "flex flex-col rounded-xl border border-outline-gray-2 bg-surface-elevation-2 text-ink-gray-8 shadow-es-2xl outline-none",
          "animate-in fade-in-50 zoom-in-[0.98] duration-100 ease-out motion-reduce:animate-none"
        )}
      >
        <div className="flex items-center gap-1 px-3 pb-2 pt-3">
          <DialogPrimitive.Title className="m-0 flex-1 px-1 text-es-sm font-medium text-ink-gray-8">Help</DialogPrimitive.Title>
          <Button variant="ghost" className="w-7 px-0" aria-label="Close help" onClick={onClose}>
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
          <TipList label="On this page" tips={here} open={open} onToggle={toggle} section={section} onGo={onGo} />
          <TipList
            label={here.length ? "More tips" : "Tips"}
            tips={rest}
            open={open}
            onToggle={toggle}
            section={section}
            onGo={onGo}
          />
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
};

export default HelpPanel;
