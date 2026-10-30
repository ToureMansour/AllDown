export class Semaphore {
  private active = 0;

  constructor(private readonly limit: number) {}

  tryAcquire(): (() => void) | null {
    if (this.active >= this.limit) return null;
    this.active += 1;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }

  get activeCount(): number {
    return this.active;
  }
}
