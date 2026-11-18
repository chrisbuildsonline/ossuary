// The folder name under apps/: the only user-chosen string that reaches a file path.
import type { Result } from '@ossuary/core/schema';

export const appNameRule = 'Use an app name of a to z, digits and -, starting with a letter, at most 40 characters.';

const appName = /^[a-z][a-z0-9-]{0,39}$/;

export const parseAppName = (name: string): Result<string, string> => (appName.test(name) ? { ok: true, value: name } : { ok: false, error: appNameRule });
