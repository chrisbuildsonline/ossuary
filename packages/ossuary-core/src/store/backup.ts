// Backup document: `{ format: "ossuary-backup", version: 1, appId, exportedAt, items }`.
import { z } from 'zod';
import type { BoneSpec } from '../schema/bone-spec';
import { checkUnique } from '../schema/common';
import { parseWith } from '../schema/issues';
import { buildItemSchema } from '../schema/item';
import { type Db, type StoreDeps, type StoredItem, compact, inTx } from './db';
import { type StoreResult, invalid } from './errors';

export const BACKUP_FORMAT = 'ossuary-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  appId: string;
  exportedAt: string;
  items: StoredItem[];
}

/** What an import did: new ids, existing ids overwritten, and (in `replace` mode) ids dropped. */
export interface ImportSummary {
  added: number;
  updated: number;
  removed: number;
}

export type ImportMode = 'merge' | 'replace';

const notBackup = 'This is not an Ossuary backup file.';
const required = (input: unknown) => (input === undefined ? 'This is required.' : undefined);

function headerSchema(spec: BoneSpec) {
  return z.object(
    {
      format: z.literal(BACKUP_FORMAT, { error: notBackup }),
      version: z.literal(BACKUP_VERSION, {
        error: (iss) => required(iss.input) ?? `Unsupported backup version ${JSON.stringify(iss.input)}. This app reads version ${BACKUP_VERSION}.`,
      }),
      appId: z.literal(spec.id, {
        error: (iss) => required(iss.input) ?? `This backup is for ${JSON.stringify(iss.input)}, not "${spec.id}".`,
      }),
    },
    { error: notBackup },
  );
}

const stamp = z.string().min(1).max(64);

function backupSchema(spec: BoneSpec) {
  const item = z.object({ id: z.string().min(1).max(200), values: buildItemSchema(spec), createdAt: stamp, updatedAt: stamp });
  return headerSchema(spec).extend({
    exportedAt: stamp,
    items: z.array(item).superRefine((items, ctx) => checkUnique(items, (i) => i.id, 'item id', ctx, (i) => [i, 'id'])),
  });
}

/** Reads backup text: JSON, then format, version and appId, then every item against the spec. Never throws. */
export function parseBackup(spec: BoneSpec, text: string): StoreResult<Backup> {
  if (typeof text !== 'string') return invalid([{ path: '', message: 'Expected the text of a backup file.' }]);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return invalid([{ path: '', message: 'This file is not valid JSON.' }]);
  }
  const header = parseWith(headerSchema(spec), json, 'Could not read this backup.');
  if (!header.ok) return invalid(header.error);
  const full = parseWith(backupSchema(spec), json, 'Could not read this backup.');
  if (!full.ok) return invalid(full.error);
  const backup = full.value as Backup;
  return { ok: true, value: { ...backup, items: backup.items.map((i) => ({ ...i, values: compact(i.values) })) } };
}

export function exportBackup(db: Db, spec: BoneSpec, deps: StoreDeps): Promise<StoreResult<Backup>> {
  return inTx(db, 'readonly', async (s) => {
    const items = await s.getAll();
    const backup: Backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, appId: spec.id, exportedAt: deps.nowIso(), items };
    return { ok: true, value: backup };
  });
}

/** Validates the whole backup first, then writes it in one `readwrite` transaction, so a failure writes nothing. */
export async function importBackup(db: Db, spec: BoneSpec, text: string, mode: ImportMode): Promise<StoreResult<ImportSummary>> {
  const parsed = parseBackup(spec, text);
  if (!parsed.ok) return parsed;
  const { items } = parsed.value;
  return inTx(db, 'readwrite', async (s) => {
    const existing = new Set(await s.getAllKeys());
    if (mode === 'replace') await s.clear();
    for (const item of items) await s.put(item);
    const incoming = new Set(items.map((i) => i.id));
    const updated = items.filter((i) => existing.has(i.id)).length;
    const removed = mode === 'replace' ? [...existing].filter((id) => !incoming.has(id)).length : 0;
    return { ok: true, value: { added: items.length - updated, updated, removed } };
  });
}
