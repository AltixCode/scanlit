import { CODE_COLOURS, CODE_QUIET_ZONE } from '../codeColours';
import { contrastRatio } from '../color';

describe('every shipped code colour actually scans', () => {
  // A QR reader needs real contrast between the modules and the quiet zone. A pale code is
  // not a style choice, it is a code that does not work — and it looks completely fine.
  for (const colour of CODE_COLOURS) {
    it(`${colour.name} clears 4.5:1 against white`, () => {
      expect(contrastRatio(colour.value, CODE_QUIET_ZONE)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('offers more than one choice', () => {
    expect(CODE_COLOURS.length).toBeGreaterThan(1);
  });

  it('gives every colour a distinct value and a name', () => {
    expect(new Set(CODE_COLOURS.map((c) => c.value)).size).toBe(CODE_COLOURS.length);
    for (const colour of CODE_COLOURS) expect(colour.name.trim().length).toBeGreaterThan(0);
  });
});
