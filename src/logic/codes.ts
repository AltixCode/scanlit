/**
 * Making codes, and making sense of scanned ones.
 *
 * The QR matrix comes from the `qrcode` package rather than being hand-rolled. A QR encoder
 * is Reed–Solomon error correction plus masking, and a subtly wrong one produces a picture
 * that looks exactly like a QR code and does not scan — the worst possible failure for this
 * app, and one no amount of looking at the output would catch. The tests decode the generated
 * matrix back with an independent decoder and assert it round-trips, which is the only proof
 * that actually means anything here.
 *
 * Everything else in this file is pure and dependency-free.
 */
import QRCode from "qrcode";

/** Error-correction levels, lowest to highest redundancy. */
export const EC_LEVELS = ["L", "M", "Q", "H"] as const;
export type EcLevel = (typeof EC_LEVELS)[number];

/** What a scanned or typed payload appears to be. Drives the actions offered. */
export type PayloadKind =
  "url" | "wifi" | "email" | "phone" | "sms" | "geo" | "vcard" | "text";

export interface Payload {
  kind: PayloadKind;
  raw: string;
  /** A human-readable one-liner. Never the raw string when that would be unreadable. */
  label: string;
}

/**
 * What a payload is.
 *
 * Checked in order of specificity: `WIFI:` before the generic text fallback, and `http` last
 * among the schemes so a `mailto:` is not mistaken for a link. Nothing here trusts the string
 * — it only categorises it, and the UI never opens anything without the user tapping.
 */
export function classify(raw: string): Payload {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (lower.startsWith("wifi:")) {
    // The separator before S: is the leading "WIFI:" or a ";" — not just ";". Requiring a
    // semicolon meant the SSID never matched in the standard payload, which starts WIFI:S:.
    const ssid = /(?:^WIFI:|;)S:((?:[^;\\]|\\.)*)/i.exec(text)?.[1];
    return {
      kind: "wifi",
      raw: text,
      label: ssid ? ssid.replace(/\\(.)/g, "$1") : text,
    };
  }
  if (lower.startsWith("mailto:"))
    return { kind: "email", raw: text, label: text.slice(7) };
  if (lower.startsWith("smsto:") || lower.startsWith("sms:")) {
    return {
      kind: "sms",
      raw: text,
      label: text.replace(/^smsto:|^sms:/i, ""),
    };
  }
  if (lower.startsWith("tel:"))
    return { kind: "phone", raw: text, label: text.slice(4) };
  if (lower.startsWith("geo:"))
    return { kind: "geo", raw: text, label: text.slice(4) };
  if (lower.startsWith("begin:vcard")) {
    const name = /(?:^|\n)FN:(.*)/i.exec(text)?.[1]?.trim();
    return { kind: "vcard", raw: text, label: name || text.slice(0, 40) };
  }
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return { kind: "url", raw: text, label: text };
  }
  return { kind: "text", raw: text, label: text };
}

/** Escapes the characters a WIFI payload treats as structure. */
const esc = (value: string): string => value.replace(/([\\;,:"])/g, "\\$1");

export interface WifiSpec {
  ssid: string;
  password?: string;
  /** `nopass` is a genuinely open network, not "we did not ask". */
  security?: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}

/** Builds the `WIFI:` payload phones understand. */
export function wifiPayload({
  ssid,
  password,
  security = "WPA",
  hidden,
}: WifiSpec): string {
  const parts = [`S:${esc(ssid)}`];
  if (security !== "nopass") parts.push(`T:${security}`);
  if (password && security !== "nopass") parts.push(`P:${esc(password)}`);
  if (hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

/**
 * The QR module matrix: `true` is a dark module.
 *
 * Returned as a grid rather than an image so the screen can render it with SVG at any size,
 * in any colour, with a logo punched out of the middle — all of which the paywall sells and
 * none of which is possible with a pre-rendered bitmap.
 */
export async function qrMatrix(
  text: string,
  level: EcLevel = "M",
): Promise<boolean[][]> {
  if (text.length === 0) throw new Error("Nothing to encode");
  const qr = QRCode.create(text, { errorCorrectionLevel: level });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const grid: boolean[][] = [];
  for (let row = 0; row < size; row += 1) {
    const cells: boolean[] = [];
    for (let col = 0; col < size; col += 1)
      cells.push(data[row * size + col] === 1);
    grid.push(cells);
  }
  return grid;
}

/**
 * The highest error-correction level that still encodes the text.
 *
 * A logo punched into the middle of a code destroys modules. Higher correction is what makes
 * that survivable, so a code that will carry a logo is encoded at `H` when the payload is
 * short enough to allow it — rather than the app quietly producing a code the logo breaks.
 */
export async function bestLevelFor(
  text: string,
  wantsLogo: boolean,
): Promise<EcLevel> {
  if (!wantsLogo) return "M";
  for (const level of ["H", "Q", "M", "L"] as EcLevel[]) {
    try {
      QRCode.create(text, { errorCorrectionLevel: level });
      return level;
    } catch {
      // Too much data for this level; try the next one down.
    }
  }
  return "L";
}

/** A one-line summary for the history list. */
export function summarise(payload: Payload, maxLength = 60): string {
  const label = payload.label.replace(/\s+/g, " ").trim();
  return label.length <= maxLength
    ? label
    : `${label.slice(0, maxLength - 1)}…`;
}

/** Whether a scanned payload is safe to offer as a tappable link. */
export function isOpenable(payload: Payload): boolean {
  // Only the schemes the OS handles sensibly, and never a bare `text` — opening arbitrary
  // scanned text as a URL is how a scanner becomes an attack surface.
  return ["url", "email", "phone", "sms", "geo"].includes(payload.kind);
}
