import { z } from 'zod';
import { boneSpecSchema } from './bone-spec';

/** JSON Schema (draft 2020-12) of the bone spec, for editors and authoring tools. */
export const boneSpecJsonSchema: object = {
  ...z.toJSONSchema(boneSpecSchema),
  title: 'Ossuary bone spec',
  description:
    'Structure only. parseBoneSpec also checks field references, sourceId references, lookup table coverage, ' +
    'unique ids, stage thresholds, the 50-rule total, and theme contrast and canvas luminance, which JSON Schema cannot express.',
};
