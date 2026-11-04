/**
 * Stickman pixel art rendering.
 *
 * Motion and strike timing live in stickmen.ts. These hand-authored grids are
 * cached by the shared sprite atlas, so each helper needs only one blit/frame.
 * Mirroring the pose is cheap and keeps both travel directions readable.
 */
import { drawSprite, STICKMAN_FRAMES } from "./sprites";
import { STICKMAN_PALETTE } from "./palette";
import type { StickmanPose } from "./stickmen";

export function drawStickman(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: StickmanPose,
  facing: number,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);

  // All animation frames use a fixed 15x18 box and feet-at-zero anchor.
  drawSprite(ctx, STICKMAN_FRAMES[pose.frame], -7, -17, STICKMAN_PALETTE);

  if (pose.frame === "land") {
    // Two single-pixel floor sparks emphasize impact without new particle
    // arrays or a per-character runtime sprite allocation.
    ctx.fillStyle = "#8b7ea3";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(-9, 0, 2, 1);
    ctx.fillRect(8, 0, 2, 1);
  }
  ctx.restore();
}
