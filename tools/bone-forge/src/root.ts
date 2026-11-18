// The repo root, found from this file's own location so the server works from any directory.
import { fileURLToPath } from 'node:url';

export const repoRoot: string = fileURLToPath(new URL('../../..', import.meta.url)).replace(/\/$/, '');
