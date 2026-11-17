// Display faces are self-hosted through @fontsource-variable and loaded on demand, so no font request leaves the origin.
import type { Theme } from '../schema/theme';

export type DisplayFont = NonNullable<Theme['display']>;

const fallback = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The CSS font-family stack written to `--font-display` for each face. */
export const displayFamilies: Record<DisplayFont, string> = {
  inter: `"Inter Variable", Inter, ${fallback}`,
  fraunces: `"Fraunces Variable", Georgia, serif`,
  'space-grotesk': `"Space Grotesk Variable", ${fallback}`,
};

export type FontLoaders = Record<DisplayFont, () => Promise<unknown>>;

const defaultLoaders: FontLoaders = {
  inter: () => import('@fontsource-variable/inter'),
  fraunces: () => import('@fontsource-variable/fraunces/full.css'),
  'space-grotesk': () => import('@fontsource-variable/space-grotesk'),
};

const loaded = new WeakMap<FontLoaders, Map<DisplayFont, Promise<boolean>>>();

/** Loads the UI face (Inter) and the given display face once each. Resolves false if a face could not load. */
export function loadDisplayFont(name: DisplayFont = 'inter', loaders: FontLoaders = defaultLoaders): Promise<boolean> {
  let cache = loaded.get(loaders);
  if (!cache) {
    cache = new Map();
    loaded.set(loaders, cache);
  }
  const load = (face: DisplayFont): Promise<boolean> => {
    const existing = cache.get(face);
    if (existing) return existing;
    const p = loaders[face]().then(
      () => true,
      () => false,
    );
    cache.set(face, p);
    return p;
  };
  return Promise.all([load('inter'), load(name)]).then(([a, b]) => a && b);
}
