// Playwright helpers for the accessibility and motion checks: axe, a settled page, running motion and a deep Tab walk.
// Generic (no app words) and only for tests; shipped code never imports this file.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** The desktop and the phone width every screen is checked at. */
export const WIDTHS = [1280, 390] as const;

/** WCAG 2.0 and 2.1, levels A and AA. Never lowered to make a page pass. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/** The parts of an axe result a failure message needs. */
export interface AxeViolation {
  id: string;
  impact?: string | null;
  help?: string;
  nodes: { target: unknown[]; any: { message: string }[]; all: { message: string }[]; none: { message: string }[] }[];
}

/** One frame of an axe target; an array is a path through shadow roots. */
const selector = (target: unknown[]) => target.map((t) => (Array.isArray(t) ? t.join(' >> ') : String(t))).join(' | ');

/** One block per violation: rule id, impact and help, then each selector with axe's own message (contrast included). */
export function formatViolations(violations: readonly AxeViolation[]): string {
  if (violations.length === 0) return '0 axe violations';
  const lines = [`${violations.length} axe ${violations.length === 1 ? 'violation' : 'violations'}:`];
  for (const v of violations) {
    lines.push(`${v.id} (${v.impact ?? 'unknown'}): ${v.help ?? ''}`.trimEnd());
    for (const n of v.nodes) {
      const messages = [...n.any, ...n.all, ...n.none].map((c) => c.message).filter(Boolean);
      lines.push(`  ${selector(n.target)}: ${messages.join('; ')}`);
    }
  }
  return lines.join('\n');
}

/** Runs axe on the whole page with AXE_TAGS: no rule disabled, no node excluded. Throws with every violation. */
export async function checkAxe(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
  if (result.violations.length > 0) throw new Error(formatViolations(result.violations as AxeViolation[]));
}

/**
 * Waits until fonts are loaded and every finite animation in the page and its open shadow roots has finished, so a
 * check reads colours and boxes at rest. Infinite idle loops (a flame sway) never finish and are left running.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => {
    const roots: (Document | ShadowRoot)[] = [document];
    for (let i = 0; i < roots.length; i++) roots[i]?.querySelectorAll('*').forEach((e) => e.shadowRoot && roots.push(e.shadowRoot));
    const finite = (a: Animation) => a.effect?.getComputedTiming().iterations !== Infinity;
    return roots.every((r) => r.getAnimations().every((a) => a.playState !== 'running' || !finite(a)));
  });
}

/**
 * Every running animation and every non-zero transition duration in the page and its open shadow roots (pseudo
 * elements included), each as "host >> tag.class: what". A rule that only pauses an animation still shows here.
 */
export function runningMotion(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const name = (e: Element) => {
      const host = (e.getRootNode() as ShadowRoot).host;
      const cls = typeof e.className === 'string' && e.className ? `.${e.className.trim().split(/\s+/).join('.')}` : '';
      return `${host ? `${host.tagName.toLowerCase()} >> ` : ''}${e.tagName.toLowerCase()}${cls}`;
    };
    const nonZero = (list: string) => list.split(',').some((d) => parseFloat(d) > 0);
    const walk = (root: Document | ShadowRoot) => {
      for (const a of root.getAnimations()) {
        if (a.playState !== 'running') continue;
        const target = (a.effect as KeyframeEffect | null)?.target;
        const label = a instanceof CSSAnimation ? `animation ${a.animationName}` : a instanceof CSSTransition ? `transition ${a.transitionProperty}` : 'script animation';
        found.push(`${target ? name(target) : '?'}: ${label} running`);
      }
      root.querySelectorAll('*').forEach((e) => {
        for (const pseudo of [null, '::before', '::after']) {
          const s = getComputedStyle(e, pseudo);
          if (nonZero(s.transitionDuration)) found.push(`${name(e)}${pseudo ?? ''}: transition-duration ${s.transitionDuration}`);
          if (s.animationName !== 'none' && nonZero(s.animationDuration)) found.push(`${name(e)}${pseudo ?? ''}: animation ${s.animationName} ${s.animationDuration}`);
        }
        if (e.shadowRoot) walk(e.shadowRoot);
      });
    };
    walk(document);
    return found;
  });
}

/** The result of a Tab walk: controls Tab or Shift+Tab never reached, and stops that showed no focus ring. */
export interface TabWalk {
  /** How many tabbable controls the walk expected. */
  total: number;
  missed: string[];
  noRing: string[];
}

/**
 * Collects every visible, enabled, tabbable control (deep through open shadow roots; only those inside an open modal
 * dialog when one is open), then presses Tab and Shift+Tab, up to 2n + 10 times each way, until each is reached.
 * A stop has a ring when the focused control has an outline of 2px or more, a box-shadow that differs from its
 * resting one, or a wrapper (up to three levels up) that gained such an outline, as `.field:has(:focus-visible)` does.
 */
export async function tabThrough(page: Page): Promise<TabWalk> {
  const total = await page.evaluate(() => {
    const ring = (e: Element) => {
      const s = getComputedStyle(e);
      return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
    };
    const wrappers = (e: Element) => {
      const up: Element[] = [];
      for (let p = e.parentElement; p && up.length < 3; p = p.parentElement) up.push(p);
      return up;
    };
    const inside = (outer: Element, e: Element) => {
      for (let n: Node | null = e; n; n = n instanceof ShadowRoot ? n.host : n.parentNode) if (n === outer) return true;
      return false;
    };
    const all: Element[] = [];
    const walk = (root: Document | ShadowRoot) =>
      root.querySelectorAll('*').forEach((e) => {
        all.push(e);
        if (e.shadowRoot) walk(e.shadowRoot);
      });
    walk(document);
    const modal = all.find((e) => e instanceof HTMLDialogElement && e.matches(':modal'));
    const found = all
      .filter((e) => e.matches('a[href], button, input, select, textarea, [tabindex]') && e.getAttribute('tabindex') !== '-1')
      .filter((e) => !(e as HTMLButtonElement).disabled && !e.closest('dialog:not([open])') && e.checkVisibility({ visibilityProperty: true }))
      .filter((e) => !modal || inside(modal, e))
      .map((el) => ({ el, shadow: getComputedStyle(el).boxShadow, wrapped: wrappers(el).map(ring) }));
    (window as unknown as { __tab: typeof found }).__tab = found;
    return found.length;
  });

  const describe = (index: number) =>
    page.evaluate((i) => {
      const el = (window as unknown as { __tab: { el: Element }[] }).__tab[i]?.el;
      if (!el) return '';
      const host = (el.getRootNode() as ShadowRoot).host?.tagName.toLowerCase();
      const words = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${host ? `${host} >> ` : ''}${el.tagName.toLowerCase()}${el.getAttribute('type') ? `[type=${el.getAttribute('type')}]` : ''} "${words}"`;
    }, index);

  const missed = new Set<string>();
  const noRing = new Set<string>();
  for (const key of ['Tab', 'Shift+Tab']) {
    const reached = new Set<number>();
    for (let i = 0; i < total * 2 + 10 && reached.size < total; i++) {
      await page.keyboard.press(key);
      const stop = await page.evaluate(() => {
        let a = document.activeElement;
        while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        const list = (window as unknown as { __tab: { el: Element; shadow: string; wrapped: boolean[] }[] }).__tab;
        const index = list.findIndex((t) => t.el === a);
        const entry = list[index];
        if (!a || !entry) return { index, ring: true };
        const has = (e: Element) => {
          const s = getComputedStyle(e);
          return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
        };
        const s = getComputedStyle(a);
        const shadow = s.boxShadow !== 'none' && s.boxShadow !== entry.shadow;
        const up: Element[] = [];
        for (let p = a.parentElement; p && up.length < 3; p = p.parentElement) up.push(p);
        const wrapper = up.some((p, j) => has(p) && !entry.wrapped[j]);
        return { index, ring: has(a) || shadow || wrapper };
      });
      if (stop.index < 0) continue;
      reached.add(stop.index);
      if (!stop.ring) noRing.add(await describe(stop.index));
    }
    for (let i = 0; i < total; i++) if (!reached.has(i)) missed.add(`${key}: ${await describe(i)}`);
  }
  return { total, missed: [...missed], noRing: [...noRing] };
}
