/** Accessible preference switches, community links and a cancellable save reset. */
const COMMUNITY_LINKS = [
  { label: "GITHUB", detail: "SekaFaji projects", href: "https://github.com/SekaFaji" },
  { label: "DISCORD", detail: "SekaFaji Games community", href: "https://discord.gg/794QQWJEeP" },
  { label: "YOUTUBE", detail: "SekaFaji Games channel", href: "https://youtube.com/@sekafajigames" },
] as const;
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
      <section aria-labelledby="community-links-heading" className="border border-white/20 bg-[#120c26] p-2">
        <h3 id="community-links-heading" className="mb-2 text-[11px] font-bold tracking-widest text-[#c9b1f4]">
          COMMUNITY
        </h3>
        <div className="grid grid-cols-1 gap-1.5">
          {COMMUNITY_LINKS.map(link => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
              className="flex min-h-[44px] items-center justify-between gap-2 border border-white/25 bg-[#1b1233] px-2 py-1 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b7b2ff] active:translate-y-[1px]">
              <span className="font-bold">{link.label}</span>
              <span className="min-w-0 truncate text-right text-[10px] text-white/65">{link.detail}</span>
              <span aria-hidden="true" className="shrink-0 text-white/55">↗</span>
            </a>
          ))}
        </div>
      </section>
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
