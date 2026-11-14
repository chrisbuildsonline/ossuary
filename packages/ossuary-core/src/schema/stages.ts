import { z } from 'zod';
import { checkUnique, identifier, text } from './common';

export const MAX_STAGES = 8;
export const tones = ['fresh', 'steady', 'soon', 'urgent', 'dead'] as const;

export const stageSchema = z
  .object({ id: identifier, label: text, tone: z.enum(tones), enterAtDays: z.number().int().min(0).max(9999).optional() })
  .strict();

/** Stages are `[first, ...middle, dead]`: no threshold first, strictly decreasing thresholds, one last dead stage. */
export const stagesSchema = z
  .array(stageSchema)
  .min(2)
  .max(MAX_STAGES)
  .superRefine((stages, ctx) => {
    checkUnique(stages, (s) => s.id, 'stage id', ctx, (i) => [i, 'id']);
    const issue = (i: number, key: string, message: string) => ctx.addIssue({ code: 'custom', path: [i, key], message });
    const lastIndex = stages.length - 1;
    let previous: number | undefined;
    stages.forEach((stage, i) => {
      if (i === lastIndex) {
        if (stage.tone !== 'dead') issue(i, 'tone', 'The last stage must have the dead tone.');
        else if (stage.enterAtDays !== undefined) issue(i, 'enterAtDays', 'The dead stage has no threshold.');
        return;
      }
      if (stage.tone === 'dead') issue(i, 'tone', 'Only the last stage can have the dead tone.');
      if (i === 0) {
        if (stage.enterAtDays !== undefined) issue(i, 'enterAtDays', 'The first stage has no threshold.');
        return;
      }
      if (stage.enterAtDays === undefined) {
        issue(i, 'enterAtDays', 'This stage needs enterAtDays, the days left when it starts.');
        return;
      }
      if (previous !== undefined && stage.enterAtDays >= previous) {
        issue(i, 'enterAtDays', `Must be lower than the stage before it (${previous}).`);
      }
      previous = stage.enterAtDays;
    });
  });

export type Tone = (typeof tones)[number];
export type Stage = z.infer<typeof stageSchema>;
