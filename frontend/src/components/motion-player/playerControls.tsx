/**
 * External dependencies.
 */
import type { PointerEvent, RefObject } from "react";
import { Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";

/**
 * Internal dependencies.
 */
import { cn } from "@/lib/utils";

type PlayerControlsProps = {
  playing: boolean;
  onToggle: () => void;
  onReplay: () => void;
  /** Jumps to a point of the motion, from 0 (start) to 1 (end). */
  onSeek: (progress: number) => void;
  /** The player moves this bar every frame (scaleX 0..1) without re-rendering. */
  progressRef: RefObject<HTMLDivElement>;
  /** Shows an expand button, and selecting the picture expands instead of pausing. */
  onExpand?: () => void;
  /** Shows a button that shrinks the enlarged view back. */
  onCollapse?: () => void;
};

const controlButton =
  "flex size-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-white cursor-pointer hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

/**
 * Play/pause, replay, progress and expand, shown on hover or focus and always
 * while paused. Place inside a `group relative` frame.
 */
export default function PlayerControls({
  playing,
  onToggle,
  onReplay,
  onSeek,
  progressRef,
  onExpand,
  onCollapse,
}: PlayerControlsProps) {
  const label = playing ? "Pause animation" : "Play animation";

  const seek = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (event.clientX - left) / width)));
  };

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 border-0 bg-transparent p-0 cursor-pointer"
        onClick={onExpand ?? onToggle}
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1.5 pt-6 transition-opacity duration-150",
          playing ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100"
        )}
      >
        <button type="button" aria-label={label} className={controlButton} onClick={onToggle}>
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </button>
        <button type="button" aria-label="Replay from the start" className={controlButton} onClick={onReplay}>
          <RotateCcw size={14} aria-hidden="true" />
        </button>
        <div
          className="mx-1 flex h-7 flex-1 cursor-pointer touch-none items-center"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seek(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              seek(event);
            }
          }}
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/30">
            <div ref={progressRef} className="h-full w-full origin-left rounded-full bg-white" />
          </div>
        </div>
        {onExpand && (
          <button type="button" aria-label="Enlarge animation" className={controlButton} onClick={onExpand}>
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        )}
        {onCollapse && (
          <button type="button" aria-label="Shrink animation" className={controlButton} onClick={onCollapse}>
            <Minimize2 size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}
