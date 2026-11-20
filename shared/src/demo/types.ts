/**
 * Narrated walkthrough format. Each app ships `demo/walkthrough.ts` exporting `script: DemoScript`.
 * tools/record-demo (Playwright + ffmpeg + the narrator voice) runs the scenes against the offline demo build,
 * records 1920x1080 video, voices every `say` line, and lays each scene's narration over the start of that scene.
 *
 * Writing rules for `say` lines (they are spoken by a cloned voice, first person, practitioner to practitioner):
 * - One sentence per line, at most ~22 words. Plain, specific, no hype words (game-changer, seamless, unlock, leverage).
 * - Say product names as people say them ("Fabric", "Power BI", "DAX", "SQL"). No URLs, ids or paths in speech.
 * - Only claim what the screen shows. Fabric Apps is generally available; never call it "preview".
 * - A scene lasts at least as long as its narration; actions run while the voice speaks, so put the visible payoff
 *   early in `run` and use `h.pause()` to hold on it.
 * - 6 to 10 scenes, 90 to 150 seconds total. Scene 1 is a hook over the most impressive screen; the last scene is a
 *   one-breath takeaway (not "follow for more").
 */
import type { Locator, Page } from '@playwright/test';

export interface DemoHelpers {
  page: Page;
  /** Open an app route in demo mode, optionally as a persona sub (fresh data on the first call only). */
  goto(path: string, persona?: string): Promise<void>;
  /** Move the visible cursor to the target, highlight it and click. Strings are treated as text/role-free selectors. */
  click(target: Locator | string): Promise<void>;
  /** Click into the field and type at a human pace (about 18 chars/s). */
  type(target: Locator | string, text: string): Promise<void>;
  /** Fill instantly (for long text the viewer does not need to watch being typed). */
  fill(target: Locator | string, text: string): Promise<void>;
  /** Choose an option of a <select> by its visible label. */
  select(target: Locator | string, label: string): Promise<void>;
  /** Move the visible cursor over the target without clicking. */
  hover(target: Locator | string): Promise<void>;
  /** Smoothly scroll the target into the middle of the viewport. */
  scrollTo(target: Locator | string): Promise<void>;
  /** Draw a temporary highlight box around the target (does not click). */
  spotlight(target: Locator | string, ms?: number): Promise<void>;
  pause(ms: number): Promise<void>;
}

export interface DemoScene {
  /** Short id, such as "hook" or "run-suite". */
  id: string;
  /** Spoken lines for this scene. */
  say: string[];
  run(h: DemoHelpers): Promise<void>;
}

export interface DemoScript {
  /** Video title, such as "Measure Unit Tests: regression tests for DAX". */
  title: string;
  /** Persona sub the recording starts as (defaults to the app's first persona). */
  persona?: string;
  scenes: DemoScene[];
}
