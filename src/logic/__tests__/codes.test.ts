import jsQR from 'jsqr';

import {
  bestLevelFor,
  classify,
  isOpenable,
  qrMatrix,
  summarise,
  wifiPayload,
} from '../codes';

/**
 * Renders a matrix to the RGBA buffer jsQR expects, with a quiet zone.
 *
 * Decoding what we generated, with a decoder that shares no code with the encoder, is the
 * only test here that proves anything: a subtly wrong QR encoder produces a picture that
 * looks exactly like a QR code and does not scan.
 */
function decode(matrix: boolean[][]): string | null {
  const scale = 4;
  const quiet = 4 * scale;
  const side = matrix.length * scale + quiet * 2;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);

  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const px = quiet + x * scale + dx;
          const py = quiet + y * scale + dy;
          const i = (py * side + px) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }),
  );

  return jsQR(data, side, side)?.data ?? null;
}

describe('qrMatrix — generated codes must actually scan', () => {
  it('round-trips plain text through an independent decoder', async () => {
    const text = 'Hello from Scanlit';
    expect(decode(await qrMatrix(text))).toBe(text);
  });

  it('round-trips a URL', async () => {
    const url = 'https://altixcode.com/scanlit';
    expect(decode(await qrMatrix(url))).toBe(url);
  });

  it('round-trips at every error-correction level', async () => {
    const text = 'Level check';
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      expect(decode(await qrMatrix(text, level))).toBe(text);
    }
  });

  it('round-trips a long payload', async () => {
    const text = 'x'.repeat(300);
    expect(decode(await qrMatrix(text))).toBe(text);
  });

  it('round-trips a wifi payload exactly, escaping and all', async () => {
    const payload = wifiPayload({ ssid: 'Cafe; Wi-Fi', password: 'p@ss:word', security: 'WPA' });
    expect(decode(await qrMatrix(payload))).toBe(payload);
  });

  it('produces a square matrix', async () => {
    const matrix = await qrMatrix('square');
    expect(matrix.length).toBeGreaterThan(0);
    for (const row of matrix) expect(row).toHaveLength(matrix.length);
  });

  it('refuses to encode nothing rather than returning an empty grid', async () => {
    await expect(qrMatrix('')).rejects.toThrow();
  });
});

describe('bestLevelFor', () => {
  it('uses the highest correction a short payload allows when a logo is wanted', async () => {
    // A logo destroys modules; high correction is what makes that survivable.
    expect(await bestLevelFor('short', true)).toBe('H');
  });

  it('steps down rather than failing when the payload is too big for H', async () => {
    const level = await bestLevelFor('y'.repeat(1200), true);
    expect(['L', 'M', 'Q', 'H']).toContain(level);
  });

  it('stays at M when no logo is wanted', async () => {
    expect(await bestLevelFor('short', false)).toBe('M');
  });

  it('still round-trips at whatever level it chose', async () => {
    const text = 'logo payload';
    const level = await bestLevelFor(text, true);
    expect(decode(await qrMatrix(text, level))).toBe(text);
  });
});

describe('wifiPayload', () => {
  it('builds the standard shape', () => {
    expect(wifiPayload({ ssid: 'Home', password: 'secret' })).toBe('WIFI:S:Home;T:WPA;P:secret;;');
  });

  it('escapes the characters that are structure', () => {
    // An unescaped semicolon in an SSID silently truncates the payload.
    expect(wifiPayload({ ssid: 'a;b', password: 'c:d' })).toContain('S:a\\;b');
    expect(wifiPayload({ ssid: 'a;b', password: 'c:d' })).toContain('P:c\\:d');
  });

  it('omits the password for a genuinely open network', () => {
    const open = wifiPayload({ ssid: 'Free', password: 'ignored', security: 'nopass' });
    expect(open).not.toContain('ignored');
    expect(open).not.toContain('T:');
  });

  it('marks a hidden network', () => {
    expect(wifiPayload({ ssid: 'Hidden', hidden: true })).toContain('H:true');
  });
});

describe('classify', () => {
  it.each([
    ['https://example.com', 'url'],
    ['http://example.com', 'url'],
    ['mailto:a@b.com', 'email'],
    ['tel:+441234567890', 'phone'],
    ['SMSTO:+44123:hi', 'sms'],
    ['geo:51.5,-0.12', 'geo'],
    ['WIFI:S:Home;T:WPA;P:x;;', 'wifi'],
    ['BEGIN:VCARD\nFN:Ada Lovelace\nEND:VCARD', 'vcard'],
    ['just some text', 'text'],
  ])('reads %s as %s', (raw, kind) => {
    expect(classify(raw).kind).toBe(kind);
  });

  it('pulls a readable label out of a wifi payload', () => {
    expect(classify('WIFI:S:Cafe\\; Wi-Fi;T:WPA;P:x;;').label).toBe('Cafe; Wi-Fi');
  });

  it('pulls the name out of a vcard', () => {
    expect(classify('BEGIN:VCARD\nFN:Ada Lovelace\nEND:VCARD').label).toBe('Ada Lovelace');
  });

  it('trims surrounding whitespace', () => {
    expect(classify('  https://example.com  ').raw).toBe('https://example.com');
  });
});

describe('isOpenable', () => {
  it('allows the schemes the OS handles', () => {
    for (const raw of ['https://x.com', 'mailto:a@b.c', 'tel:123', 'geo:1,2']) {
      expect(isOpenable(classify(raw))).toBe(true);
    }
  });

  it('refuses plain text and wifi', () => {
    // Treating arbitrary scanned text as a link is how a scanner becomes an attack surface:
    // a code can carry any string at all, and the app must not act on it unprompted.
    expect(isOpenable(classify('javascript:alert(1)'))).toBe(false);
    expect(isOpenable(classify('some arbitrary payload'))).toBe(false);
    expect(isOpenable(classify('WIFI:S:x;;'))).toBe(false);
  });
});

describe('summarise', () => {
  it('leaves a short label alone', () => {
    expect(summarise(classify('short'))).toBe('short');
  });

  it('collapses whitespace and truncates with an ellipsis', () => {
    const long = summarise(classify(`a${'b'.repeat(100)}`), 20);
    expect(long).toHaveLength(20);
    expect(long.endsWith('…')).toBe(true);
  });
});
