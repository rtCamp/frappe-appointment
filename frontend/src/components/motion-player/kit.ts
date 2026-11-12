/**
 * The kit a motion scene runs against.
 */

/** Position of `time` between `start` and `end`, clamped to 0..1. */
export const seg = (time: number, start: number, end: number) =>
  end === start
    ? time >= end
      ? 1
      : 0
    : Math.min(1, Math.max(0, (time - start) / (end - start)));
export const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;
/** Ease out (cubic). */
export const eo = (progress: number) => 1 - Math.pow(1 - progress, 3);
/** Ease in (cubic). */
export const ei = (progress: number) => progress * progress * progress;
/** Ease in-out (cubic). */
export const eio = (progress: number) =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

/** The stage every scene draws on; the player scales it to fit. */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

type CameraKey = {
  t: number;
  cx: number;
  cy: number;
  z: number;
  /** Seconds to stay on this framing before moving to the next key. */
  hold?: number;
  /** Slow movement per second while on this key: [dx, dy, dz]. */
  drift?: [number, number, number];
};
type Framing = { cx: number; cy: number; z: number };

/** Pans and zooms an element that holds the whole 1920×1080 scene. */
export class Camera {
  private keys: CameraKey[] = [];

  constructor(public el: HTMLElement) {
    el.style.transformOrigin = "0 0";
  }

  set(keys: CameraKey[]) {
    this.keys = [...keys].sort((first, second) => first.t - second.t);
  }

  private framing(key: CameraKey, time: number): Framing {
    const [driftX, driftY, driftZoom] = key.drift ?? [0, 0, 0];
    const elapsed = Math.max(0, time - key.t);
    return {
      cx: key.cx + driftX * elapsed,
      cy: key.cy + driftY * elapsed,
      z: key.z + driftZoom * elapsed,
    };
  }

  at(t: number): Framing {
    const keys = this.keys;
    if (!keys.length)
      return { cx: STAGE_WIDTH / 2, cy: STAGE_HEIGHT / 2, z: 1 };
    if (t <= keys[0].t) return this.framing(keys[0], keys[0].t);
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const nextKey = keys[index + 1];
      if (!nextKey) return this.framing(key, t);
      const moveStart = Math.min(key.t + (key.hold ?? 0), nextKey.t);
      if (t < moveStart) return this.framing(key, t);
      if (t < nextKey.t) {
        const from = this.framing(key, moveStart);
        const to = this.framing(nextKey, nextKey.t);
        const eased = eio(seg(t, moveStart, nextKey.t));
        return {
          cx: lerp(from.cx, to.cx, eased),
          cy: lerp(from.cy, to.cy, eased),
          z: lerp(from.z, to.z, eased),
        };
      }
    }
    return this.framing(keys[keys.length - 1], t);
  }

  apply(t: number) {
    const { cx, cy, z } = this.at(t);
    this.el.style.transform = `translate(${STAGE_WIDTH / 2 - cx * z}px, ${
      STAGE_HEIGHT / 2 - cy * z
    }px) scale(${z})`;
  }
}

const ARROW =
  '<svg width="22" height="28" viewBox="0 0 22 28" style="position:absolute;left:-2px;top:-2px;overflow:visible"><path d="M2 2 L2 22.5 L7.4 17.6 L11.3 26 L15 24.4 L11.2 16.2 L18.4 16.2 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

type CursorKey = { t: number; at: [number, number] };

/** A mouse pointer that follows keyed positions, with presses and ripples. */
export class Cursor {
  el: HTMLDivElement;
  keys: CursorKey[] = [];
  /** Times of single clicks. */
  clicks: number[] = [];
  /** [start, end] spans where the button is held down (drags). */
  holds: [number, number][] = [];
  private body: HTMLDivElement;
  private ripple: HTMLDivElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.style.cssText =
      "position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;pointer-events:none;z-index:50;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.3))";
    this.ripple = document.createElement("div");
    this.ripple.style.cssText =
      "position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:2px solid var(--accent,#3B82F6);box-sizing:border-box;opacity:0";
    this.body = document.createElement("div");
    this.body.style.cssText =
      "position:absolute;left:0;top:0;transform-origin:0 0";
    this.body.innerHTML = ARROW;
    this.el.append(this.ripple, this.body);
  }

  private position(time: number): [number, number] {
    const keys = this.keys;
    if (!keys.length) return [0, 0];
    if (time <= keys[0].t) return keys[0].at;
    for (let index = 0; index < keys.length - 1; index++) {
      const fromKey = keys[index];
      const toKey = keys[index + 1];
      if (time < toKey.t) {
        const eased = eio(seg(time, fromKey.t, toKey.t));
        return [
          lerp(fromKey.at[0], toKey.at[0], eased),
          lerp(fromKey.at[1], toKey.at[1], eased),
        ];
      }
    }
    return keys[keys.length - 1].at;
  }

  render(t: number) {
    const [x, y] = this.position(t);
    this.el.style.transform = `translate(${x}px, ${y}px)`;

    // How far the button is pressed: quick dip for clicks, steady for holds.
    let press = 0;
    for (const click of this.clicks) {
      press = Math.max(
        press,
        seg(t, click - 0.06, click) * (1 - seg(t, click, click + 0.14)),
      );
    }
    for (const [holdStart, holdEnd] of this.holds) {
      press = Math.max(
        press,
        seg(t, holdStart - 0.06, holdStart) *
          (1 - seg(t, holdEnd, holdEnd + 0.1)),
      );
    }
    this.body.style.transform = `scale(${1 - 0.14 * press})`;

    // A small, quick ripple from the most recent click.
    let lastClick = -Infinity;
    for (const click of this.clicks) {
      if (click <= t && click > lastClick) lastClick = click;
    }
    const rippleProgress = seg(t, lastClick, lastClick + 0.32);
    if (rippleProgress > 0 && rippleProgress < 1) {
      this.ripple.style.opacity = String(0.6 * (1 - rippleProgress));
      this.ripple.style.transform = `scale(${lerp(0.35, 1, eo(rippleProgress))})`;
    } else {
      this.ripple.style.opacity = "0";
    }
  }
}

/** Types `text` from `start`, `charsPerSecond` characters per second. */
export class Typist {
  readonly end: number;
  constructor(
    private text: string,
    private start: number,
    private charsPerSecond: number,
  ) {
    this.end = start + text.length / charsPerSecond;
  }
  at(t: number) {
    const charCount = Math.floor((t - this.start) * this.charsPerSecond);
    return this.text.slice(
      0,
      Math.max(0, Math.min(this.text.length, charCount)),
    );
  }
}

export type SceneDef = {
  init(this: SceneDef, kit: Kit): void;
  render(this: SceneDef, t: number): void;
  [key: string]: unknown;
};

export type Kit = ReturnType<typeof createKit>;

/** The `kit` object a scene file receives. */
export function createKit(stage: HTMLElement) {
  const scenes = new Map<string, SceneDef>();
  return {
    seg,
    lerp,
    eo,
    ei,
    eio,
    /** Where a scene's init() builds its DOM. The player points it at each scene's layer before init. */
    stage,
    Camera,
    scenes,
    /** Turns an HTML string into nodes ready to append. */
    h(html: string): DocumentFragment {
      const template = document.createElement("template");
      template.innerHTML = html.trim();
      return template.content;
    },
    cursor: () => new Cursor(),
    typist: (text: string, start: number, charsPerSecond: number) =>
      new Typist(text, start, charsPerSecond),
    scene(id: string, def: SceneDef) {
      scenes.set(id, def);
    },
  };
}

/** What a `./motion?motion` import gives (see tools/vite-plugin-motion.ts). */
export type MotionModule = {
  /** Folder name; the motion's CSS is scoped to [data-motion="<name>"]. */
  name: string;
  /** The manifest describes the scenes and their durations. */
  manifest: { scenes: { id: string; dur: number }[] };
  /** Each scene file's code; calling it registers the scene with kit.scene(). */
  scenes: ((kit: Kit) => void)[];
};
