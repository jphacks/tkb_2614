import type { Motion } from './types';

/** Choose once per gesture, excluding the previous choice without retry loops. */
export class RandomIdle {
  private cycle = -1;
  private index = -1;

  constructor(private choices: readonly Motion[], private random = Math.random) {
    if (choices.length < 2) throw new Error('Random idle requires at least two motions');
    const { duration, delay } = choices[0];
    if (duration <= 0 || delay !== 0 || choices.some((motion) => motion.duration !== duration || motion.delay !== 0)) {
      throw new Error('Random idle motions must share a positive duration and no delay');
    }
  }

  at(elapsed: number): Motion {
    const cycle = Math.floor(elapsed / this.choices[0].duration);
    if (cycle !== this.cycle) {
      const count = this.choices.length - (this.index < 0 ? 0 : 1);
      const next = Math.floor(this.random() * count);
      this.index = this.index >= 0 && next >= this.index ? next + 1 : next;
      this.cycle = cycle;
    }
    return this.choices[this.index];
  }
}
