import type { RepeatedFailure } from "./types";

const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

interface OpenWindow {
  endpoint: string;
  statusCode: number;
  repeats: number;
  usernames: Set<string>;
}

/**
 * The first failure of an endpoint alerts immediately. Identical failures
 * within the window are counted and reported once, as a single summary,
 * when the window closes.
 */
export class FailureCoalescer {
  private windows = new Map<string, OpenWindow>();

  constructor(
    private onRepeatedFailures: (summary: RepeatedFailure) => void,
    private windowMs = DEFAULT_WINDOW_MS,
  ) {}

  /** Returns true when this failure should be alerted right away. */
  shouldAlert(endpoint: string, statusCode: number, username: string): boolean {
    const key = `${statusCode} ${endpoint}`;
    const openWindow = this.windows.get(key);

    if (openWindow) {
      openWindow.repeats += 1;
      openWindow.usernames.add(username);
      return false;
    }

    this.windows.set(key, {
      endpoint,
      statusCode,
      repeats: 0,
      usernames: new Set([username]),
    });
    setTimeout(() => this.closeWindow(key), this.windowMs).unref();
    return true;
  }

  private closeWindow(key: string) {
    const window = this.windows.get(key);
    this.windows.delete(key);
    if (!window || window.repeats === 0) {
      return;
    }

    this.onRepeatedFailures({
      endpoint: window.endpoint,
      statusCode: window.statusCode,
      count: window.repeats,
      usernames: [...window.usernames],
      windowMinutes: Math.round(this.windowMs / 60000),
    });
  }
}
