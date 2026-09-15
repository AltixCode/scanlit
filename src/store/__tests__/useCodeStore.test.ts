import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CODE_CACHE_KEY,
  FREE_BATCH,
  FREE_HISTORY,
  MAX_BATCH,
  useCodeStore,
} from '../useCodeStore';

const reset = () => useCodeStore.setState({ history: [], colour: null });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  reset();
});

describe('recording scans', () => {
  it('records a scan with its kind', () => {
    expect(useCodeStore.getState().record('https://example.com')).toBe('recorded');
    expect(useCodeStore.getState().history[0]!.kind).toBe('url');
  });

  it('ignores an empty scan', () => {
    expect(useCodeStore.getState().record('   ')).toBe('ignored');
    expect(useCodeStore.getState().history).toHaveLength(0);
  });

  it('drops an immediate repeat', () => {
    // A camera fires the same code many times a second; without this the history fills with
    // one scan repeated forty times.
    useCodeStore.getState().record('same');
    expect(useCodeStore.getState().record('same')).toBe('ignored');
    expect(useCodeStore.getState().history).toHaveLength(1);
  });

  it('records the same code again after something else', () => {
    useCodeStore.getState().record('a');
    useCodeStore.getState().record('b');
    expect(useCodeStore.getState().record('a')).toBe('recorded');
    expect(useCodeStore.getState().history).toHaveLength(3);
  });

  it('removes one entry, and clears them all', () => {
    useCodeStore.getState().record('a');
    useCodeStore.getState().record('b');
    useCodeStore.getState().remove(useCodeStore.getState().history[0]!.id);
    expect(useCodeStore.getState().history).toHaveLength(1);
    useCodeStore.getState().clear();
    expect(useCodeStore.getState().history).toHaveLength(0);
  });
});

describe('history limits', () => {
  const fill = (n: number) => {
    for (let i = 0; i < n; i += 1) useCodeStore.getState().record(`code-${i}`);
  };

  it('shows a free user the most recent only', () => {
    fill(FREE_HISTORY + 7);
    expect(useCodeStore.getState().visible(false)).toHaveLength(FREE_HISTORY);
  });

  it('shows a paying user everything', () => {
    fill(FREE_HISTORY + 7);
    expect(useCodeStore.getState().visible(true)).toHaveLength(FREE_HISTORY + 7);
  });

  it('searches within what the tier can see', () => {
    fill(FREE_HISTORY + 7);
    // The oldest entries are outside a free user's window, so searching must not reveal them.
    expect(useCodeStore.getState().search('code-0', false)).toHaveLength(0);
    expect(useCodeStore.getState().search('code-0', true).length).toBeGreaterThan(0);
  });

  it('returns everything visible for an empty query', () => {
    fill(3);
    expect(useCodeStore.getState().search('  ', true)).toHaveLength(3);
  });

  it('exports one line per scan', () => {
    useCodeStore.getState().record('https://a.com');
    useCodeStore.getState().record('plain text');
    const lines = useCodeStore.getState().exportHistory().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('plain text');
  });

  it('exports nothing rather than throwing when empty', () => {
    expect(useCodeStore.getState().exportHistory()).toBe('');
  });
});

describe('generator settings', () => {
  it('refuses a custom colour to a free user', () => {
    expect(useCodeStore.getState().setColour('#FF0000', false)).toBe('locked');
    expect(useCodeStore.getState().colour).toBeNull();
  });

  it('allows one for a paying user, and allows anyone back to the default', () => {
    expect(useCodeStore.getState().setColour('#FF0000', true)).toBe('set');
    expect(useCodeStore.getState().colour).toBe('#FF0000');
    expect(useCodeStore.getState().setColour(null, false)).toBe('set');
    expect(useCodeStore.getState().colour).toBeNull();
  });
});

describe('batch generation', () => {
  it('gives a free user one code at a time', () => {
    expect(useCodeStore.getState().batchLimit(false)).toBe(FREE_BATCH);
    expect(useCodeStore.getState().splitBatch('a\nb\nc', false)).toEqual(['a']);
  });

  it('gives a paying user a sheet', () => {
    expect(useCodeStore.getState().batchLimit(true)).toBe(MAX_BATCH);
    expect(useCodeStore.getState().splitBatch('a\nb\nc', true)).toEqual(['a', 'b', 'c']);
  });

  it('caps even a paying user — a sheet is not a print run', () => {
    const many = Array.from({ length: MAX_BATCH + 20 }, (_, i) => `line${i}`).join('\n');
    expect(useCodeStore.getState().splitBatch(many, true)).toHaveLength(MAX_BATCH);
  });

  it('drops blank lines rather than generating empty codes', () => {
    expect(useCodeStore.getState().splitBatch('a\n\n   \nb', true)).toEqual(['a', 'b']);
  });
});

describe('persistence', () => {
  it('round-trips history and colour', async () => {
    useCodeStore.getState().record('https://a.com');
    useCodeStore.getState().setColour('#00FF00', true);
    await useCodeStore.getState().persist();

    reset();
    await useCodeStore.getState().hydrate();
    expect(useCodeStore.getState().history).toHaveLength(1);
    expect(useCodeStore.getState().colour).toBe('#00FF00');
  });

  it('starts empty on stored rubbish', async () => {
    await AsyncStorage.setItem(CODE_CACHE_KEY, '{"history":"none","colour":7}');
    await useCodeStore.getState().hydrate();
    expect(useCodeStore.getState().history).toEqual([]);
    expect(useCodeStore.getState().colour).toBeNull();
  });
});
