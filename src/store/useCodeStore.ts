/**
 * Scan history, generator settings and the batch sheet.
 *
 * Three of the paywall's four claims are enforced here — custom colours, batch generation and
 * unlimited searchable history — and each takes `isPremium` explicitly.
 *
 * Nothing is uploaded. The tagline says "nothing leaves your phone" and that is a claim about
 * this file: there is no network call anywhere in the app, and the history lives only in
 * AsyncStorage on the device.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { type Payload, classify } from "@/logic/codes";

export const CODE_CACHE_KEY = "scanlit.state.v1";

/** Scans a free user can look back through. The purchase keeps the lot. */
export const FREE_HISTORY = 25;
/** Codes a free user can generate at once. The purchase lifts it. */
export const FREE_BATCH = 1;
/** A ceiling even for a paying user: a sheet is a sheet, not a print run. */
export const MAX_BATCH = 50;

export interface ScanRecord {
  id: string;
  raw: string;
  kind: Payload["kind"];
  at: number;
}

interface CodeState {
  history: ScanRecord[];
  /** Foreground colour of generated codes. `null` means the theme default. */
  colour: string | null;

  record: (raw: string) => "recorded" | "ignored";
  remove: (id: string) => void;
  clear: () => void;
  visible: (isPremium: boolean) => ScanRecord[];
  search: (query: string, isPremium: boolean) => ScanRecord[];
  exportHistory: () => string;
  setColour: (colour: string | null, isPremium: boolean) => "set" | "locked";
  batchLimit: (isPremium: boolean) => number;
  /** Splits pasted lines into a batch, capped by tier. */
  splitBatch: (text: string, isPremium: boolean) => string[];
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

let counter = 0;
const nextId = (): string =>
  `${Date.now().toString(36)}-${(counter += 1).toString(36)}`;

function validHistory(value: unknown): ScanRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is ScanRecord =>
      !!r &&
      typeof r === "object" &&
      typeof (r as ScanRecord).id === "string" &&
      typeof (r as ScanRecord).raw === "string" &&
      typeof (r as ScanRecord).at === "number",
  );
}

export const useCodeStore = create<CodeState>((set, get) => ({
  history: [],
  colour: null,

  record(raw) {
    const text = raw.trim();
    if (!text) return "ignored";
    const { history } = get();
    // A camera fires the same code many times a second. Recording each one would fill the
    // history with one scan repeated forty times, so an immediate repeat is dropped.
    if (history[0]?.raw === text) return "ignored";

    const entry: ScanRecord = {
      id: nextId(),
      raw: text,
      kind: classify(text).kind,
      at: Date.now(),
    };
    set((s) => ({ history: [entry, ...s.history] }));
    void get().persist();
    return "recorded";
  },

  remove(id) {
    set((s) => ({ history: s.history.filter((r) => r.id !== id) }));
    void get().persist();
  },

  clear() {
    set({ history: [] });
    void get().persist();
  },

  visible(isPremium) {
    const { history } = get();
    return isPremium ? history : history.slice(0, FREE_HISTORY);
  },

  search(query, isPremium) {
    const needle = query.trim().toLowerCase();
    const rows = get().visible(isPremium);
    if (!needle) return rows;
    return rows.filter((r) => r.raw.toLowerCase().includes(needle));
  },

  exportHistory() {
    return get()
      .history.map(
        (r) => `${new Date(r.at).toISOString()}\t${r.kind}\t${r.raw}`,
      )
      .join("\n");
  },

  setColour(colour, isPremium) {
    if (!isPremium && colour !== null) return "locked";
    set({ colour });
    void get().persist();
    return "set";
  },

  batchLimit(isPremium) {
    return isPremium ? MAX_BATCH : FREE_BATCH;
  },

  splitBatch(text, isPremium) {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.slice(0, get().batchLimit(isPremium));
  },

  async persist() {
    const { history, colour } = get();
    try {
      await AsyncStorage.setItem(
        CODE_CACHE_KEY,
        JSON.stringify({ history, colour }),
      );
    } catch {
      // A lost history is survivable; a failed launch is not.
    }
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(CODE_CACHE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const record = parsed as Record<string, unknown>;
      set({
        history: validHistory(record.history),
        colour: typeof record.colour === "string" ? record.colour : null,
      });
    } catch {
      // Unreadable storage starts empty rather than preventing launch.
    }
  },
}));
