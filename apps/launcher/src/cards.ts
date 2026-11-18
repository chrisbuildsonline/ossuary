// The two apps on the launcher, read from their bone specs at build time. The launcher imports no app code.
import type { Theme } from '../../../packages/ossuary-core/src/schema/index.ts';
import type { Motif } from '../../../packages/ossuary-core/src/ui/motifs/index.ts';
import pantry from '../../pantry-reaper/bone.json';
import wraith from '../../warranty-wraith/bone.json';

export const REPO_URL = 'https://github.com/chrisbuildsonline/ossuary';
export const REMIX_URL = `${REPO_URL}/blob/main/docs/REMIX.md`;

export interface CardData {
  /** The app's folder in apps/ and in dist/. */
  folder: string;
  href: string;
  name: string;
  blurb: string;
  /** The public data the app is built on, as an eyebrow. */
  source: string;
  theme: Theme;
  motif: Motif;
}

interface SpecJson {
  name: string;
  theme: object;
  sources?: { name: string }[];
}

function card(folder: string, spec: SpecJson, blurb: string): CardData {
  // hook:spec validates every bone.json against the schema, so the JSON theme is a Theme.
  const theme = spec.theme as Theme;
  return { folder, href: `./${folder}/`, name: spec.name, blurb, source: spec.sources?.[0]?.name ?? '', theme, motif: theme.motif ?? 'hourglass' };
}

export const cards: readonly CardData[] = [
  card('pantry-reaper', pantry, 'Know when the food in your kitchen dies.'),
  card('warranty-wraith', wraith, 'Know when a return window or warranty runs out.'),
];
