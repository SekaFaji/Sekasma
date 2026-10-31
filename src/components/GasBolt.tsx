import { gasById } from "../game/gases";
import type { GasId } from "../game/types";

/** Each noble gas has a small, distinct pixel lightning silhouette and color. */
const BOLTS: Record<GasId, readonly string[]> = {
  neon: [
    "0001000", "0011000", "0111000", "0001100",
    "0011000", "0010000", "0100000", "0100000",
  ],
  argon: [
    "0001100", "0011100", "0110000", "0001110",
    "0001100", "0011000", "0110000", "0100000",
  ],
  xenon: [
    "0011000", "0111100", "0011100", "0001100",
    "0111100", "0011000", "0110000", "0100000",
  ],
  krypton: [
    "0011100", "0011100", "0111000", "0001110",
    "0001110", "0011100", "0011000", "0100000",
  ],
};
export default function GasBolt({ gas }: { gas: GasId }) {
  const color = gasById(gas).color;
  return (
    <svg aria-hidden="true" width="9" height="12" viewBox="0 0 7 8"
      shapeRendering="crispEdges" className="shrink-0" style={{ color }}>
      {BOLTS[gas].flatMap((row, y) => [...row].map((pixel, x) =>
        pixel === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null
      ))}
    </svg>
  );
}
