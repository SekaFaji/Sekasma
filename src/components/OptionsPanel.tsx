/** Accessible preference switches and a deliberate, cancellable save reset. */
export default function OptionsPanel({
  scanlines, buzz, confirmReset, onToggleScanlines, onToggleBuzz, onReset, onCancelReset,
}: {
  scanlines: boolean;
  buzz: boolean;
  confirmReset: boolean;
  onToggleScanlines: () => void;
  onToggleBuzz: () => void;
  onReset: () => void;
  onCancelReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <button
        type="button"
        aria-pressed={scanlines}
        onClick={onToggleScanlines}
        className="flex min-h-[44px] items-center justify-between border border-white/25 bg-[#1b1233] p-2 text-left active:translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff]"
      >
        <span>CRT SCANLINES</span>
        <span style={{ color: scanlines ? "#61e06b" : "#ffffffb0" }}>
          {scanlines ? "ON" : "OFF"}
        </span>
      </button>
      <button
        type="button"
        aria-pressed={buzz}
        onClick={onToggleBuzz}
        className="flex min-h-[44px] items-center justify-between border border-white/25 bg-[#1b1233] p-2 text-left active:translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff]"
      >
        <span>HAPTIC BUZZ</span>
        <span style={{ color: buzz ? "#61e06b" : "#ffffffb0" }}>
          {buzz ? "ON" : "OFF"}
        </span>
      </button>
      {confirmReset ? (
        <div role="group" aria-label="Confirm reset" className="border border-[#ff5ec8]/60 bg-[#2a1233] p-2">
          <p className="mb-2 text-[11px] leading-relaxed text-white/85">
            RESET ALL SAVED PROGRESS? THIS CANNOT BE UNDONE.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancelReset}
              className="min-h-[44px] border border-white/40 bg-[#1b1233] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={onReset}
              className="min-h-[44px] border border-[#ff5ec8] bg-[#45172d] font-bold text-[#ffb0df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff5ec8]"
            >
              CONFIRM RESET
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onReset}
          className="min-h-[44px] border border-white/40 bg-[#120c26] p-2 text-white/80 active:translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff]"
        >
          RESET SAVE
        </button>
      )}
    </div>
  );
}
