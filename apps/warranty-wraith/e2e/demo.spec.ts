// The Warranty Wraith step of the demo script (docs/DEMO.md), on the shipped CPSC data: add a DREO space heater with
// its receipt date, the recall banner shows the whole notice, the calendar file holds both dates, and the claim reminder
// carries the ready-to-send claim note.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import ICAL from 'ical.js';
import type { Recall } from '../src/data/cpsc';
import { guard } from './guard';
import { addPurchase, day } from './purchases';

const script = readFileSync(new URL('../../../docs/DEMO.md', import.meta.url), 'utf8');
const name = 'DREO space heater';
const recalls = JSON.parse(readFileSync(new URL('../src/data/recalls.json', import.meta.url), 'utf8')) as Recall[];
const recall = recalls.find((r) => r.id === '27054');

test('demo: a DREO space heater, its recall banner and the calendar file', async ({ page }) => {
  expect(script).toContain(name);
  expect(recall?.brands).toContain('DREO');

  await page.setViewportSize({ width: 1280, height: 800 });
  const g = guard(page);
  await page.goto('/');
  await addPurchase(page, { name, bought: day(-20) });

  // The home line counts it with any first-visit sample that matches a recall.
  await expect(page.locator('.ww-home oss-banner[variant="line"]').getByRole('button')).toContainText(name);
  await page.locator('oss-item', { hasText: name }).click();
  const detail = page.locator('.ww-detail');
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText(name);

  const status = detail.locator('oss-banner').getByRole('status');
  await expect(status).toContainText('Possible recall match');
  await expect(status).toContainText(`CPSC 27054: ${recall?.names[0]}, ${recall?.hazard}`);
  expect(recall?.hazard).toMatch(/[.…]$/);

  const [download] = await Promise.all([page.waitForEvent('download'), detail.getByRole('button', { name: 'Add to calendar' }).click()]);
  const ics = readFileSync((await download.path()) ?? '', 'utf8');
  const events = new ICAL.Component(ICAL.parse(ics)).getAllSubcomponents('vevent').map((e) => new ICAL.Event(e));
  expect(events.map((e) => e.summary).sort()).toEqual([`${name} - Return window`, `${name} - Warranty`]);

  // The claim reminder: one event on the warranty's last day, carrying the ready-to-send claim note.
  expect(script).toContain('Claim reminder');
  const warrantyDay = events.find((e) => e.summary === `${name} - Warranty`)?.startDate.toString();
  const [claimFile] = await Promise.all([page.waitForEvent('download'), detail.getByRole('button', { name: 'Claim reminder' }).click()]);
  expect(claimFile.suggestedFilename()).toBe('warranty-wraith-claim.ics');
  const claims = new ICAL.Component(ICAL.parse(readFileSync((await claimFile.path()) ?? '', 'utf8'))).getAllSubcomponents('vevent');
  expect(claims).toHaveLength(1);
  const claim = new ICAL.Event(claims[0]);
  expect(claim.summary).toBe(`Warranty claim: ${name}`);
  expect(claim.startDate.toString()).toBe(warrantyDay);
  expect(claim.description).toContain(`I would like to make a warranty claim for my ${name}, bought at Corner shop on `);
  expect(claim.description).toContain('My receipt is attached.');
  await expect(page.locator('oss-toast .toast')).toContainText('Claim reminder saved');

  g.check();
});
