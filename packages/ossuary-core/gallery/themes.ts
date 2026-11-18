// The gallery's three themes: the core fixture theme and a warm and a cool one. The page and the contrast test share them.
import core from './fixtures/core.json';

export const galleryThemes = {
  core: core.theme,
  warm: { accent: '#b8460e', accentInk: '#9a3a0b', accentTint: '#fbe9dc', canvas: '#f2efea', display: 'fraunces', motif: 'candle', emptyArt: 'candle-jar-moon', wordmark: 'Widget Shelf' },
  cool: { accent: '#5a4bd1', accentInk: '#5a4bd1', accentTint: '#ebe9fb', canvas: '#edeff6', display: 'space-grotesk', motif: 'ghost', emptyArt: 'ghost-parcel', wordmark: 'Widget Shelf' },
};
