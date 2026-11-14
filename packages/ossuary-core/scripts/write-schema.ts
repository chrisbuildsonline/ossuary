// Regenerates bone-spec.schema.json from the zod schema. Run: bun run schema (in packages/ossuary-core).
import { writeFileSync } from 'node:fs';
import { boneSpecJsonSchema } from '../src/schema/json-schema';

writeFileSync(new URL('../bone-spec.schema.json', import.meta.url), `${JSON.stringify(boneSpecJsonSchema, null, 2)}\n`);
