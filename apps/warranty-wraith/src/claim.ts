// The ready-to-send warranty claim message that the claim reminder carries in its calendar event. Pure: no clock.
import type { Item } from '@ossuary/core';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-05" -> "5 November 2026", read from the string so no time zone moves the day. */
const longDay = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function claimNote(values: Item, warrantyEnds: string): string {
  const model = text(values.model);
  const retailer = text(values.retailer);
  const price = typeof values.price === 'number' ? `$${Number.isInteger(values.price) ? values.price : values.price.toFixed(2)}` : '';
  const bought = [retailer && `at ${retailer}`, typeof values.bought === 'string' && `on ${longDay(values.bought)}`, price && `for ${price}`].filter(Boolean);
  return [
    'Hello,',
    '',
    `I would like to make a warranty claim for my ${text(values.name)}${model ? ` (model ${model})` : ''}, bought ${bought.join(' ')}.`,
    `Its warranty runs until ${longDay(warrantyEnds)}.`,
    '',
    'The fault: ',
    '',
    'My receipt is attached.',
  ].join('\n');
}
