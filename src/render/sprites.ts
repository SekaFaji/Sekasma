/**
 * Pixel-art engine: sprite models as string grids, 8-way orientation
 * baking (quarter turns plus a nearest-neighbour 45-degree fold), the
 * low-level canvas blitters and the tiny pixel font.
 */
import { PX, CX, CY, R } from "./geometry";
import { GHOST_PALETTE } from "./palette";

/**
 * Hand-pixeled, anatomically proportioned helpers.
 * Each character = one logical pixel; '.' = transparent.
 * 0 outline, 1 lit skin, 2 side shadow, 3 midtone,
 * 4 nail bed, 5 nail glint, 6 nail edge, 7 knuckle crease,
 * 8 warm highlight, 9 plasma-lit contact pixel.
 *
 * Upright sprites point toward the top of the frame. The orbital renderer
 * rotates cached versions once; no filtering or external image assets.
 */
export const FINGER_SPRITE = [
  "...0000...",
  "..011110..",
  ".01555510.",
  ".01644410.",
  ".01644410.",
  ".01666610.",
  ".02881310.",
  ".02181310.",
  ".02113310.",
  ".02771310.",
  ".02113310.",
  ".02113310.",
  ".02117710.",
  ".02113310.",
  ".02113310.",
  ".02113310.",
  ".02113310.",
  "..000000..",
];

// Contact is a different hand-pixeled pose, not merely a translated sprite:
// the distal joint bends toward the glass, with a faint ionized highlight.
export const FINGER_PRESS_SPRITE = [
  "..0000....",
  ".015510...",
  "01555510..",
  "01644410..",
  "01644410..",
  ".0166610..",
  "..028910..",
  "..021310..",
  ".0277310..",
  ".02113310.",
  ".02113310.",
  ".02113310.",
  ".02117710.",
  ".02113310.",
  ".02113310.",
  ".02113310.",
  ".02113310.",
  "..000000..",
];

// The big toe has a wider, flatter nail plate and narrows at its base.
export const FOOT_SPRITE = [
  "....0000....",
  "..00111100..",
  ".0188888810.",
  ".0166666610.",
  ".0155555510.",
  ".0144444510.",
  ".0166666610.",
  ".0211883310.",
  ".0211113310.",
  ".0211773310.",
  "..02113310..",
  "..02113310..",
  "...0213100..",
  "...021110...",
  "....0000....",
];

// A squat, slightly flattened contact pose gives the big toe a heavy press.
export const FOOT_PRESS_SPRITE = [
  "...000000...",
  "..01111100..",
  ".0188888810.",
  ".0166666610.",
  ".0155555510.",
  ".0144444510.",
  ".0166666610.",
  ".0211993310.",
  ".0211773310.",
  "..02113310..",
  "..02113310..",
  "..02113310..",
  "...0213100..",
  "...021110...",
  "....0000....",
];

// The same anatomical design for the player's manual touch.
export const PLAYER_FINGER = FINGER_PRESS_SPRITE;

// the ghost hand: reaches from the electrode, fingers toward the glass
export const GHOST_SPRITE = [
  "2.2.2.2",
  "2.2.2.2",
  "1212121",
  "1111111",
  ".11111.",
  ".11111.",
  ".11111.",
  "..111..",
  "..111..",
  "...1...",
];
export const STICKMAN_SPRITE = [
  "..0....", ".010...", "..0.2..", ".1012..", "..0....", ".1.1...", "1...1..",
];

export function rotCW(s: string[]): string[] {
  const H = s.length;
  const W = s[0].length;
  const out: string[] = [];
  for (let y = 0; y < W; y++) {
    let row = "";
    for (let x = 0; x < H; x++) row += s[H - 1 - x][y];
    out.push(row);
  }
  return out;
}

// 45° nearest-neighbour rotation → helpers face the ball in 8 ways
export function rot45(s: string[]): string[] {
  const H = s.length;
  const W = s[0].length;
  const D = Math.ceil((W + H) / Math.SQRT2) + 1;
  const cos = Math.cos(Math.PI / 4);
  const sin = Math.sin(Math.PI / 4);
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const mid = (D - 1) / 2;
  const out: string[] = [];
  for (let y = 0; y < D; y++) {
    let row = "";
    for (let x = 0; x < D; x++) {
      const dx = x - mid;
      const dy = y - mid;
      const sx = Math.round(dx * cos + dy * sin + cx);
      const sy = Math.round(-dx * sin + dy * cos + cy);
      row +=
        sy >= 0 && sy < H && sx >= 0 && sx < W && s[sy][sx] !== "."
          ? s[sy][sx]
          : ".";
    }
    out.push(row);
  }
  return out;
}

// 8 orientations at 45° steps: 0, 45, 90 ... 315 (clockwise)
export function sprOrients8(spr: string[]): string[][] {
  const q = [spr, rotCW(spr), rotCW(rotCW(spr)), rotCW(rotCW(rotCW(spr)))];
  return [q[0], rot45(q[0]), q[1], rot45(q[1]), q[2], rot45(q[2]), q[3], rot45(q[3])];
}
export const FINGER_ORIENTS = sprOrients8(FINGER_SPRITE);
export const FINGER_PRESS_ORIENTS = sprOrients8(FINGER_PRESS_SPRITE);
export const FOOT_ORIENTS = sprOrients8(FOOT_SPRITE);
export const FOOT_PRESS_ORIENTS = sprOrients8(FOOT_PRESS_SPRITE);
export const GHOST_ORIENTS = sprOrients8(GHOST_SPRITE);

/** Rasterize repeated pixel sprites only once, then blit cached bitmaps.
 * One drawImage per helper instead of dozens of per-pixel fillRect calls.
 * Cache holds only the small, fixed set of sprite orientations/palettes.
 */
const spriteAtlas = new Map<string, HTMLCanvasElement>();
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  palette: Record<string, string>,
) {
  const key = sprite.join("|") + JSON.stringify(palette);
  let art = spriteAtlas.get(key);
  if (!art) {
    art = document.createElement("canvas");
    art.width = sprite[0].length;
    art.height = sprite.length;
    const pen = art.getContext("2d")!;
    for (let r = 0; r < sprite.length; r++)
      for (let c = 0; c < sprite[r].length; c++) {
        const ch = sprite[r][c];
        if (ch === ".") continue;
        pen.fillStyle = palette[ch];
        pen.fillRect(c, r, 1, 1);
      }
    spriteAtlas.set(key, art);
  }
  ctx.drawImage(art, Math.round(x), Math.round(y));
}

export function drawOriented(
  ctx: CanvasRenderingContext2D,
  orients: string[][],
  angle: number,
  press: number,
  palette: Record<string, string>,
  orbitRadius = R - 1,
  pressOrients?: string[][],
) {
  const inwardA = angle + Math.PI;
  const idx = ((Math.round((inwardA + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
  const spr = press > 0.4 && pressOrients ? pressOrients[idx] : orients[idx];
  const w = spr[0].length;
  const h = spr.length;
  const len = Math.max(w, h);
  const rad = orbitRadius - Math.round(press * 2) + len / 2;
  drawSprite(
    ctx, spr,
    Math.round(CX + Math.cos(angle) * rad - w / 2),
    Math.round(CY + Math.sin(angle) * rad - h / 2),
    palette,
  );
}

// ghost hands: grow from the electrode, fingers point OUT to the glass
export function drawGhost(
  ctx: CanvasRenderingContext2D,
  angle: number,
  reach: number,
  alpha: number,
  t: number,
) {
  const idx = ((Math.round((angle + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
  const spr = GHOST_ORIENTS[idx];
  const w = spr[0].length;
  const h = spr.length;
  const jitter = Math.sin(t * 21) * 0.6;
  ctx.globalAlpha = alpha;
  drawSprite(
    ctx, spr,
    Math.max(0, Math.min(PX - w, Math.round(CX + Math.cos(angle) * (reach + jitter) - w / 2))),
    Math.max(0, Math.min(PX - h, Math.round(CY + Math.sin(angle) * (reach + jitter) - h / 2))),
    GHOST_PALETTE,
  );
  ctx.globalAlpha = 1;
}
// ---------- UI pixel icons (no emoji) ----------
export const VOLT_ICON = [
  "...111.",
  "..111..",
  ".111...",
  ".1111..",
  "..111..",
  ".111...",
  "111....",
  "11.....",
];
export const FIL_ICON = [
  "...11..",
  "..111..",
  ".111...",
  "111....",
  ".111...",
  "..111..",
  "...11..",
  "....11.",
];
export const GAS_ICON = [
  "1111111",
  "..111..",
  "...1...",
  "...1...",
  "..1.1..",
  "..1.1..",
  ".1...1.",
  ".11111.",
];
export const SPLIT_ICON = [
  "1.....1",
  "11...11",
  ".11.11.",
  "..111..",
  "...1...",
  "...1...",
  "...1...",
  "...1...",
];
// ---------- Text: tiny pixel font ----------
export const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "+": ["000", "010", "111", "010", "000"],
  ".": ["000", "000", "000", "000", "010"],
  K: ["101", "101", "110", "101", "101"],
  M: ["101", "111", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  P: ["111", "101", "111", "100", "100"],
  R: ["111", "101", "111", "110", "101"],
  E: ["111", "100", "111", "100", "111"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  H: ["101", "101", "111", "101", "101"],
  A: ["010", "101", "111", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  " ": ["000", "000", "000", "000", "000"],
};

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  str: string,
  color: string,
) {
  ctx.fillStyle = color;
  let cursor = x - ((str.length * 4 - 1) / 2);
  for (const ch of str) {
    const glyph = FONT[ch];
    if (glyph)
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          if (glyph[r][c] === "1")
            ctx.fillRect(Math.round(cursor + c), Math.round(y + r), 1, 1);
    cursor += 4;
  }
}
