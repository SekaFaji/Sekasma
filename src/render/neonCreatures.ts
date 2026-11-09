/**
 * Original hand-defined pixel creatures for the Neon chapter.
 * 13x13 Spark Mites and 17x15 Copper Spiders, each with two walk poses
 * and an impact pose. All pixels are cached by the existing sprite atlas.
 */
import { drawSprite } from "./sprites.ts";

export const SPARK_MITE_FRAMES = [
  [
    "....3...3....",
    "....6...6....",
    ".....6..6....",
    "....06260....",
    "...0222220...",
    "6662522252666",
    "..611171116..",
    "...1131311...",
    "...0114110...",
    "666.01110.666",
    ".............",
    ".............",
    ".............",
  ],
  [
    "....3...3....",
    "....6...6....",
    ".....6..6....",
    "66..06260..66",
    "..602222206..",
    "...2522252...",
    "..611171116..",
    "66.1131311.66",
    "..601141106..",
    "....01110....",
    ".............",
    ".............",
    ".............",
  ],
  [
    "....3...3....",
    "....6...6....",
    ".....67.6....",
    "66.4062604.66",
    "..602222206..",
    "...2522252...",
    "..611141116..",
    "66.1131311.66",
    "..601141106..",
    "....01110....",
    ".............",
    ".............",
    ".............",
  ],
];

export const COPPER_SPIDER_FRAMES = [
  [
    ".................",
    ".................",
    ".......000.......",
    "......02220......",
    "2...600515006...2",
    "2226.2011102.6222",
    ".226022000220622.",
    "....011131110....",
    "..2601131311062..",
    "2226.1111111.6222",
    "22..600171006..22",
    ".......000.......",
    ".................",
    ".................",
    ".................",
  ],
  [
    ".................",
    ".................",
    ".......000.......",
    "2226..02220..6222",
    "....600515006....",
    ".....2011102.....",
    "22260220002206222",
    "....011131110....",
    "..2601131311062..",
    ".2...1111111...2.",
    "2...600171006...2",
    "..26...000...62..",
    ".2.............2.",
    "2...............2",
    ".................",
  ],
  [
    ".................",
    ".................",
    ".......000.......",
    "......02220......",
    "2...400515004...2",
    "2226.2011102.6222",
    ".226022000220622.",
    "....011141110....",
    "..2601141411062..",
    "2226.1111111.6222",
    "22..600171006..22",
    ".......000.......",
    ".................",
    ".................",
    ".................",
  ],
];

export const MITE_PALETTE: Readonly<Record<string, string>> = {
  "0": "#2c1737", "1": "#aa3d83", "2": "#ee7dc1",
  "3": "#ffcc76", "4": "#ffffff", "5": "#75f4ff",
  "6": "#6e3869", "7": "#f4a4e1",
};
export const SPIDER_PALETTE: Readonly<Record<string, string>> = {
  "0": "#281d38", "1": "#784534", "2": "#b46e46",
  "3": "#edb36c", "4": "#ffffff", "5": "#8cf7f4",
  "6": "#734f67", "7": "#ffdf98",
};

export type NeonCreature = "mite" | "spider";

/** No per-frame sprite construction; one atlas blit plus a few impact pixels. */
export function drawNeonCreature(
  ctx: CanvasRenderingContext2D,
  kind: NeonCreature, centerX: number, centerY: number,
  t: number, index: number, contacting: boolean,
): void {
  const mite = kind === "mite";
  const frames = mite ? SPARK_MITE_FRAMES : COPPER_SPIDER_FRAMES;
  const phase = Math.sin(t * (mite ? 13 : 8) + index * 1.73);
  const sprite = frames[contacting ? 2 : phase >= 0 ? 0 : 1] ;
  const px = Math.round(centerX - sprite[0].length / 2);
  const py = Math.round(centerY - sprite.length / 2);
  drawSprite(ctx, sprite, px, py, mite ? MITE_PALETTE : SPIDER_PALETTE);
  if (contacting) {
    ctx.fillStyle = mite ? "#fff4fc" : "#ffe3a4";
    ctx.fillRect(Math.round(centerX), Math.round(centerY) - (mite ? 6 : 8), 2, 2);
    ctx.fillStyle = "#89faff";
    ctx.fillRect(Math.round(centerX) + (mite ? 5 : 7), Math.round(centerY), 1, 1);
  }
}
