// Browser downloads. Kept in ui/ so ics/ stays free of the DOM.
import type { Now } from '../engine/evaluate';
import { type IcsEntry, type IcsExport, exportIcs } from '../ics/export-ics';
import type { BoneSpec } from '../schema/bone-spec';

export type Download = (filename: string, text: string, mime: string) => void;

/** Offers `text` as a file download through a temporary object URL. */
export const downloadText: Download = (filename, text, mime) => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Builds the calendar file for `entries`, downloads it and confirms with a "Calendar file saved" toast. */
export function saveCalendar(
  spec: BoneSpec,
  entries: IcsEntry[],
  now: Now,
  toast?: { show(message: string): void } | null,
  download: Download = downloadText,
): IcsExport {
  const result = exportIcs(spec, entries, { now });
  download(`${spec.id}.ics`, result.ics, 'text/calendar');
  toast?.show('Calendar file saved');
  return result;
}
