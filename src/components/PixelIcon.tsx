/** Renders a sprite grid as an inline pixel-art icon for the UI. */
import { useEffect, useRef } from "react";
import { drawSprite } from "../render/sprites";

export default function PixelIcon({
  sprite, color, px = 2, palette,
}: {
  sprite: string[];
  color?: string;
  px?: number;
  palette?: Record<string, string>;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = sprite[0].length;
    const h = sprite.length;
    c.width = w;
    c.height = h;
    ctx.clearRect(0, 0, w, h);
    drawSprite(ctx, sprite, 0, 0, palette ?? { "1": color ?? "#ffffff" });
  }, [sprite, color, palette]);
  return (
    <canvas
      ref={ref}
      style={{
        width: sprite[0].length * px,
        height: sprite.length * px,
        imageRendering: "pixelated",
        display: "inline-block",
      }}
    />
  );
}
