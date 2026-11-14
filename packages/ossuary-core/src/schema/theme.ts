import { z } from 'zod';
import { text } from './common';
import { contrastRatio, relativeLuminance } from './contrast';

export const MIN_CONTRAST = 4.5;
export const CANVAS_LUMINANCE = { min: 0.84, max: 0.89 } as const;
export const defaultTheme = { canvas: '#eef0f4', accentInk: '#3657c9', accentTint: '#e8edfa' } as const;

const hexPattern = /^#[0-9a-f]{6}$/i;
const hex = z.string().regex(hexPattern, 'Use a colour in the form #rrggbb.');

/** Floor to two decimals so a failing ratio never reads as 4.50. */
const ratioText = (r: number) => `${(Math.floor(r * 100) / 100).toFixed(2)}:1`;

export const themeSchema = z
  .object({
    accent: hex.optional(),
    accentInk: hex.optional(),
    accentTint: hex.optional(),
    canvas: hex.optional(),
    display: z.enum(['inter', 'fraunces', 'space-grotesk']).optional(),
    motif: z.enum(['hourglass', 'candle', 'ghost']).optional(),
    emptyArt: z.enum(['hourglass-side', 'candle-jar-moon', 'ghost-parcel']).optional(),
    wordmark: text.optional(),
  })
  .strict()
  .superRefine((t, ctx) => {
    const valid = (c: string | undefined): c is string => c !== undefined && hexPattern.test(c);
    const tooLow = (fg: string, bg: string) => contrastRatio(fg, bg) < MIN_CONTRAST;
    const fail = (key: string, what: string, fg: string, bg: string) =>
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `${what} is ${ratioText(contrastRatio(fg, bg))}; it must be at least ${MIN_CONTRAST}:1.`,
      });

    const canvas = t.canvas ?? defaultTheme.canvas;
    if (valid(t.accent) && valid(canvas)) {
      if (tooLow(t.accent, '#ffffff')) fail('accent', 'Accent contrast on white', t.accent, '#ffffff');
      if (tooLow(t.accent, canvas)) fail('accent', `Accent contrast on the canvas (${canvas})`, t.accent, canvas);
    }

    if (valid(t.canvas)) {
      const l = relativeLuminance(t.canvas);
      if (l < CANVAS_LUMINANCE.min || l > CANVAS_LUMINANCE.max) {
        ctx.addIssue({
          code: 'custom',
          path: ['canvas'],
          message: `Canvas luminance is ${l.toFixed(4)}; it must be between ${CANVAS_LUMINANCE.min} and ${CANVAS_LUMINANCE.max}.`,
        });
      }
    }

    if (t.accentInk !== undefined || t.accentTint !== undefined) {
      const ink = t.accentInk ?? defaultTheme.accentInk;
      const tint = t.accentTint ?? defaultTheme.accentTint;
      if (valid(ink) && valid(tint) && tooLow(ink, tint)) {
        fail(t.accentInk !== undefined ? 'accentInk' : 'accentTint', 'Accent ink contrast on the accent tint', ink, tint);
      }
    }
  });

export type Theme = z.infer<typeof themeSchema>;
