// Entry point: core tokens, the two display faces, then the page. The launcher registers no service worker.
import { loadDisplayFont } from '../../../packages/ossuary-core/src/ui/fonts.ts';
import { ensureDocumentTokens } from '../../../packages/ossuary-core/src/ui/styles.ts';
import { cards } from './cards';
import { renderLauncher } from './page';

ensureDocumentTokens();
for (const c of cards) void loadDisplayFont(c.theme.display);
renderLauncher(document.body, cards);
