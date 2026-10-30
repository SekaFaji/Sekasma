/** Settings panel; its state and changes remain owned by the application shell. */
export default function OptionsPanel({
  scanlines, buzz, confirmReset, onToggleScanlines, onToggleBuzz, onReset,
}: {
  scanlines: boolean;
  buzz: boolean;
  confirmReset: boolean;
  onToggleScanlines: () => void;
  onToggleBuzz: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <button
        onClick={onToggleScanlines}
        className="flex items-center justify-between border-2 border-white/25 bg-[#1b1233] min-h-[44px] p-2 active:translate-y-[1px]"
      >
        <span>CRT SCANLINES</span>
        <span style={{ color: scanlines ? "#61e06b" : "#ffffff70" }}>
          {scanlines ? "ON" : "OFF"}
        </span>
      </button>
      <button
        onClick={onToggleBuzz}
        className="flex items-center justify-between border-2 border-white/25 bg-[#1b1233] min-h-[44px] p-2 active:translate-y-[1px]"
      >
        <span>HAPTIC BUZZ</span>
        <span style={{ color: buzz ? "#61e06b" : "#ffffff70" }}>
          {buzz ? "ON" : "OFF"}
        </span>
      </button>
      <button
        onClick={onReset}
        className="min-h-[44px] border-2 p-2 active:translate-y-[1px]"
        style={{
          borderColor: confirmReset ? "#ff5ec8" : "#ffffff40",
          color: confirmReset ? "#ff5ec8" : "#ffffffb0",
          background: confirmReset ? "#2a1233" : "#120c26",
        }}
      >
        {confirmReset ? "TAP AGAIN TO CONFIRM RESET" : "RESET SAVE"}
      </button>
      <p className="px-1 text-[10px] leading-relaxed text-white/60">
        V0.12.3 · RELIABILITY, PERFORMANCE AND READABILITY.
      </p>
    </div>
  );
}
