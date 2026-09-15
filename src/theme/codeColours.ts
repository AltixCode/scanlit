/**
 * Colours a generated code may be drawn in.
 *
 * In `src/theme/` because every colour literal in the app is. Each one is dark enough to keep
 * a code readable against white — a QR scanner needs real contrast between module and quiet
 * zone, and a pale code is not a style choice, it is a code that does not work. The screen
 * warns anyway if a chosen colour falls below the threshold, and the test below asserts that
 * none of the shipped options ever do.
 */

export interface CodeColour {
  name: string;
  value: string;
}

export const CODE_COLOURS: CodeColour[] = [
  { name: 'Ink', value: '#0F172A' },
  { name: 'Indigo', value: '#3730A3' },
  { name: 'Teal', value: '#0F766E' },
  { name: 'Crimson', value: '#9F1239' },
  { name: 'Forest', value: '#14532D' },
  { name: 'Plum', value: '#6B21A8' },
];

/**
 * The quiet zone a printed or displayed code sits on.
 *
 * White, and not a theme token: a scanner needs a light quiet zone whatever the app's theme is
 * doing, so this is a property of the QR format rather than of the design. It lives here
 * because every colour literal does, and it is what `contrastRatio` is measured against when
 * deciding whether a chosen module colour is dark enough to read.
 */
export const CODE_QUIET_ZONE = "#FFFFFF";
