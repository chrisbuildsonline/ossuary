// Plain-language trace lines from fixed templates and spec labels. Durations read in the spec's own units.
import type { BoneSpec } from '../schema/bone-spec';
import { formatDuration } from '../schema/rules';
import { fromDayNumber } from './iso-day';
import type { Step } from './rules';

export interface TraceLine {
  ruleId: string; // 'base' for the base line
  kind: 'base' | 'extend' | 'shorten' | 'clamp' | 'lookup';
  text: string;
  deltaDays: number; // signed change to the expiry day
  changed: boolean;
  sourceId?: string;
}

function sentence(spec: BoneSpec, step: Step): string {
  const fieldOf = (key: string) => spec.entity.fields.find((f) => f.key === key);
  switch (step.kind) {
    case 'base': {
      const { base } = step;
      if (base.type === 'duration') return `Base: ${base.label ?? 'Base lifespan'} ${formatDuration(base)}`;
      return `Base: ${base.label ?? fieldOf(base.field)?.label ?? base.field} ${fromDayNumber(step.after)}`;
    }
    case 'extend':
      return `${step.rule.label ?? step.rule.id} extends by ${formatDuration(step.rule.by)}`;
    case 'shorten': {
      const text = `${step.rule.label ?? step.rule.id} shortens by ${formatDuration(step.rule.by)}`;
      return step.floored ? `${text}, stopped at the start day` : text;
    }
    case 'clamp': {
      const label = step.rule.label ?? 'Limit';
      if (step.bound === 'max' && step.rule.max) return `${label}: at most ${formatDuration(step.rule.max)}`;
      if (step.bound === 'min' && step.rule.min) return `${label}: at least ${formatDuration(step.rule.min)}`;
      return `${label}: no change`;
    }
    case 'lookup': {
      const field = fieldOf(step.rule.field);
      const amount = `${formatDuration(step.duration)}${step.fromDefault ? ' (default)' : ''}`;
      const name = field?.label ?? step.rule.field;
      if (step.value === undefined) return `${name} not set: ${amount}`;
      const option = field?.kind === 'enum' ? field.options.find((o) => o.value === step.value)?.label : undefined;
      return `${name} is ${option ?? JSON.stringify(step.value)}: ${amount}`;
    }
  }
}

/** One line per step, in order. A source id adds the source's name in brackets. */
export function traceLines(spec: BoneSpec, steps: Step[]): TraceLine[] {
  return steps.map((step) => {
    const from = step.kind === 'base' ? step.base : step.rule;
    const source = from.sourceId === undefined ? undefined : (spec.sources?.find((s) => s.id === from.sourceId)?.name ?? from.sourceId);
    const deltaDays = step.after - step.before;
    return {
      ruleId: step.kind === 'base' ? 'base' : step.rule.id,
      kind: step.kind,
      text: source === undefined ? sentence(spec, step) : `${sentence(spec, step)} (${source})`,
      deltaDays,
      changed: deltaDays !== 0,
      ...(from.sourceId !== undefined && { sourceId: from.sourceId }),
    };
  });
}
