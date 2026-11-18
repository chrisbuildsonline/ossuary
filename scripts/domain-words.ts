// The words ossuary-core must never hold. The list lives in domain-words.json, read by hook:boundary,
// the core's own boundary test and bone-forge's template tests.
import { readFileSync } from 'node:fs';

export const domainWords: readonly string[] = JSON.parse(readFileSync(new URL('./domain-words.json', import.meta.url), 'utf8'));
