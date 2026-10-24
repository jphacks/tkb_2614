type Listener = (elapsed: number, reactionAt: number | null, active: boolean) => void;

/** One frame driver per mascot, shared by all its independently timed groups. */
export class MascotClock {
  private listeners = new Set<Listener>();
  private frame: number | null = null;
  private previous: number | null = null;
  private elapsed = 0;
  private reactionAt: number | null = null;
  private active = false;

  constructor(
    private requestFrame: (callback: (time: number) => void) => number,
    private cancelFrame: (frame: number) => void,
  ) {}

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.elapsed, this.reactionAt, this.active);
    return () => { this.listeners.delete(listener); };
  }

  setActive(active: boolean) {
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
    this.previous = null;
    this.active = active;
    // Never queue reactions across a pause, a different artwork, or an unmount.
    this.reactionAt = null;
    this.notify();
    if (active) this.frame = this.requestFrame(this.tick);
  }

  react() {
    if (!this.active) return;
    this.reactionAt = this.elapsed;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.elapsed, this.reactionAt, this.active));
  }

  private tick = (time: number) => {
    if (!this.active) return;
    if (this.previous !== null) this.elapsed += Math.max(0, time - this.previous);
    this.previous = time;
    this.notify();
    this.frame = this.requestFrame(this.tick);
  };
}
