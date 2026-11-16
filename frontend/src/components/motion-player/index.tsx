/**
 * External dependencies.
 */
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

/**
 * Internal dependencies.
 */
import { cn } from "@/lib/utils";
import { createKit, STAGE_HEIGHT, STAGE_WIDTH, type MotionModule } from "./kit";
import PlayerControls from "./playerControls";

type MotionPlayerProps = {
  /** Lazy import of a motion, e.g. () => import("./motions/pause-bookings?motion"). */
  load: () => Promise<MotionModule>;
  /** What the motion shows, for screen readers. */
  label: string;
  /** Freeze playback from outside, e.g. while the enlarged view is open. */
  paused?: boolean;
  /** Shows an expand button that calls this. */
  onExpand?: () => void;
  /** Shows a shrink button that calls this. */
  onCollapse?: () => void;
};

type Timeline = { draw: (t: number) => void; duration: number };

/**
 * Plays a help motion as live DOM.
 */
export default function MotionPlayer({ load, label, paused = false, onExpand, onCollapse }: MotionPlayerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const [timeline, setTimeline] = useState<Timeline>();
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const resize = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / STAGE_WIDTH));
    const intersect = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    resize.observe(frame);
    intersect.observe(frame);
    return () => {
      resize.disconnect();
      intersect.disconnect();
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!stage || !frame) return;
    let cancelled = false;

    load()
      .then((mod) => {
        if (cancelled) return;
        stage.dataset.motion = mod.name;
        // The app's font is set on the screens, not on the page's body.
        stage.style.setProperty("--sans", getComputedStyle(frame).fontFamily);

        // Each scene builds its DOM in its own layer.
        const kit = createKit(stage);
        for (const register of mod.scenes) register(kit);
        let start = 0;
        const tracks = mod.manifest.scenes.map(({ id, dur }) => {
          const def = kit.scenes.get(id);
          if (!def) throw new Error(`Motion ${mod.name}: no scene ${id}`);
          const layer = document.createElement("div");
          layer.style.cssText = "position:absolute;inset:0";
          stage.append(layer);
          kit.stage = layer;
          def.init.call(def, kit);
          const track = { def, layer, start, dur };
          start += dur;
          return track;
        });
        const duration = start;

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          elapsedRef.current = Math.max(0, duration - 0.5);
          setPlaying(false);
        }
        setTimeline({
          duration,
          draw: (t) => {
            const active = tracks.find((tr) => t < tr.start + tr.dur) ?? tracks[tracks.length - 1];
            for (const tr of tracks) {
              tr.layer.style.visibility = tr === active ? "visible" : "hidden";
            }
            active.def.render.call(active.def, t - active.start);
            if (progressRef.current) {
              progressRef.current.style.transform = `scaleX(${t / duration})`;
            }
          },
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Help motion failed", error);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      stage.replaceChildren();
    };
  }, [load]);

  // Draw once the controls exist, so the progress bar matches the first frame.
  useEffect(() => {
    timeline?.draw(elapsedRef.current);
  }, [timeline]);

  useEffect(() => {
    if (!timeline || !playing || paused || !visible) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsedRef.current = (elapsedRef.current + Math.min(now - last, 100) / 1000) % timeline.duration;
      last = now;
      timeline.draw(elapsedRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeline, playing, paused, visible]);

  if (failed) return null;

  const seek = (time: number) => {
    elapsedRef.current = time;
    timeline?.draw(time);
  };

  const replay = () => {
    seek(0);
    setPlaying(true);
  };

  return (
    <div
      ref={frameRef}
      aria-busy={!timeline}
      className="group relative aspect-video w-full overflow-hidden rounded-lg bg-surface-gray-2"
    >
      <div
        ref={stageRef}
        role="img"
        aria-label={label}
        className={cn(
          "absolute left-0 top-0 origin-top-left overflow-hidden transition-opacity duration-200",
          timeline ? "opacity-100" : "opacity-0"
        )}
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale})`,
        }}
      />
      {timeline ? (
        <PlayerControls
          playing={playing}
          onToggle={() => setPlaying(!playing)}
          onReplay={replay}
          onSeek={(progress) => seek(progress * timeline.duration)}
          progressRef={progressRef}
          onExpand={onExpand}
          onCollapse={onCollapse}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-ink-gray-5">
          <LoaderCircle className="w-5 h-5 animate-spin" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
