/** Pixel-drawn plasma orb + custom 5x7 block lettering shared across screens. */
const GLYPHS: Record<string, string[]> = {
  S: ["01111","10000","10000","01110","00001","00001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"],
  K: ["10001","10010","10100","11000","10100","10010","10001"],
  A: ["01110","10001","10001","11111","10001","10001","10001"],
  M: ["10001","11011","10101","10101","10001","10001","10001"],
};
const WORD = "SEKASMA";
const ORB = [
  "..333..",
  ".32223.",
  "3221223",
  "3210123",
  "3221223",
  ".32223.",
  "..333..",
];
const ORB_COLORS: Record<string, string> = {
  "0": "#fff0ff", "1": "#fc6ddc", "2": "#62237d", "3": "#a79af8",
};

/** Pure SVG pixels stay crisp at either title size. Animations are CSS-only. */
export default function SekasmaLogo({ big = false }: { big?: boolean }) {
  return (
    <svg
      role="img"
      aria-label="Sekasma pixel-art plasma logo"
      viewBox="0 0 250 52"
      className={big ? "sekasma-pixel-logo sekasma-pixel-logo-large" : "sekasma-pixel-logo"}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
    >
      <title>SEKASMA</title>
      <g className="sekasma-pixel-orb">
        {ORB.map((row, y) => [...row].map((pixel, x) =>
          pixel !== "." && <rect key={x + "-" + y} x={9 + 4 * x} y={8 + 4 * y}
            width={4} height={4} fill={ORB_COLORS[pixel]} />
        ))}
        <path d="M23 22 h-7 v-6 h-3 M23 22 h8 v-4 h4 M23 22 v-8 h4"
          fill="none" stroke="#ffd3fb" strokeWidth={2} />
        <rect x={21} y={22} width={5} height={5} fill="#fff7ff" />
        <rect x={17} y={36} width={19} height={4} fill="#39305e" />
        <rect x={12} y={40} width={29} height={4} fill="#7b6fbd" />
        <rect x={15} y={44} width={23} height={2} fill="#31264e" />
      </g>
      <g className="sekasma-pixel-letters">
        {WORD.split("").flatMap((letter, i) =>
          GLYPHS[letter].flatMap((row, y) =>
            [...row].map((pixel, x) => pixel === "1" &&
              <rect key={i + "-" + x + "-" + y}
                x={58 + 25 * i + 4 * x} y={11 + 4 * y}
                width={4} height={4}
                fill={i % 3 === 1 ? "#c6d8ff" : i % 3 === 2 ? "#ffc3f5" : "#f1e3ff"} />
            ).filter(Boolean)
          )
        )}
        <rect x={58} y={43} width={171} height={2} fill="#8d4db1" opacity={0.65} />
      </g>
      <g className="sekasma-pixel-spark sekasma-pixel-spark-one" fill="#a5f9ff">
        <rect x={4} y={13} width={3} height={6}/><rect x={1} y={19} width={6} height={3}/>
        <rect x={34} y={4} width={3} height={5}/><rect x={37} y={8} width={5} height={3}/>
        <rect x={234} y={8} width={6} height={3}/><rect x={237} y={11} width={3} height={5}/>
      </g>
      <g className="sekasma-pixel-spark sekasma-pixel-spark-two" fill="#ff8be8">
        <rect x={45} y={17} width={3} height={6}/><rect x={42} y={21} width={6} height={3}/>
        <rect x={230} y={36} width={6} height={3}/><rect x={233} y={32} width={3} height={5}/>
        <rect x={7} y={37} width={5} height={3}/>
      </g>
    </svg>
  );
}
