/** Organized settings with two independent reset confirmations. */
export type ResetStep = 0 | 1 | 2;
const LINKS = [
  { label: "GITHUB", detail: "SekaFaji projects", href: "https://github.com/SekaFaji" },
  { label: "DISCORD", detail: "SekaFaji Games community", href: "https://discord.gg/794QQWJEeP" },
  { label: "YOUTUBE", detail: "SekaFaji Games channel", href: "https://youtube.com/@sekafajigames" },
] as const;

export default function OptionsPanel({
  scanlines, buzz, fullscreen, fullscreenAvailable, resetStep, onToggleScanlines, onToggleBuzz, onToggleFullscreen,
  onStartReset, onNextReset, onConfirmReset, onCancelReset,
}: {
  scanlines: boolean; buzz: boolean; fullscreen: boolean; fullscreenAvailable: boolean; resetStep: ResetStep;
  onToggleScanlines: () => void; onToggleBuzz: () => void; onToggleFullscreen: () => void;
  onStartReset: () => void; onNextReset: () => void;
  onConfirmReset: () => void; onCancelReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-[11px]">
      <section aria-labelledby="display-settings-heading" className="border border-white/15 bg-[#120c26] p-2">
        <h2 id="display-settings-heading" className="mb-2 font-bold tracking-widest text-[#d4b6ff]">DISPLAY & FEEDBACK</h2>
        {[
          { label: "CRT SCANLINES", description: "PIXEL SCREEN OVERLAY", enabled: scanlines, onClick: onToggleScanlines },
          { label: "HAPTIC BUZZ", description: "TOUCH VIBRATION", enabled: buzz, onClick: onToggleBuzz },
        ].map(setting => (
          <button key={setting.label} type="button" aria-pressed={setting.enabled} onClick={setting.onClick}
            className="mb-1 flex min-h-[48px] w-full items-center justify-between gap-2 border border-white/20 bg-[#1b1233] px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <span><span className="block font-bold">{setting.label}</span>
              <span className="block text-[9px] text-white/55">{setting.description}</span></span>
            <span className="min-w-[40px] border border-white/20 px-1.5 py-1 text-center font-bold"
              style={{ color: setting.enabled ? "#61e06b" : "#ffffff90" }}>{setting.enabled ? "ON" : "OFF"}</span>
          </button>
        ))}
        {fullscreenAvailable && (
          <button type="button" aria-pressed={fullscreen} onClick={onToggleFullscreen}
            className="flex min-h-[48px] w-full items-center justify-between gap-2 border border-white/20 bg-[#1b1233] px-2 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <span><span className="block font-bold">FULLSCREEN</span>
              <span className="block text-[9px] text-white/55">HIDE BROWSER CHROME WHERE SUPPORTED</span></span>
            <span className="min-w-[40px] border border-white/20 px-1.5 py-1 text-center font-bold"
              style={{ color: fullscreen ? "#61e06b" : "#ffffff90" }}>{fullscreen ? "ON" : "OFF"}</span>
          </button>
        )}
      </section>
      <section aria-labelledby="community-settings-heading" className="border border-white/15 bg-[#120c26] p-2">
        <h2 id="community-settings-heading" className="mb-2 font-bold tracking-widest text-[#d4b6ff]">SEKAFAJI COMMUNITY</h2>
        {LINKS.map(link => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
            className="mb-1 flex min-h-[44px] items-center justify-between gap-2 border border-white/20 bg-[#1b1233] px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <span className="font-bold">{link.label}</span>
            <span className="min-w-0 truncate text-[10px] text-white/60">{link.detail}</span>
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </section>
      <section aria-labelledby="save-settings-heading" className="border border-[#e86f88]/40 bg-[#241121] p-2">
        <h2 id="save-settings-heading" className="mb-1 font-bold tracking-widest text-[#ffa9bd]">SAVE MANAGEMENT</h2>
        <p className="text-[10px] leading-relaxed text-white/70">
          THE GAME SAVES AUTOMATICALLY TO THIS BROWSER. DELETING A SAVE ALSO REMOVES ALL PRESTIGE SPARKS AND PERMANENT UPGRADES.
        </p>
        {resetStep === 0 ? (
          <button type="button" onClick={onStartReset}
            className="mt-2 min-h-[44px] w-full border border-[#e28c9f]/60 bg-[#381d2a] font-bold text-[#ffb8c7]">
            RESET SAVE
          </button>
        ) : (
          <div role="group" aria-label="Confirm reset" className="mt-2 border border-[#ff768b]/50 bg-[#391724] p-2">
            <p className="mb-2 text-[11px] font-bold leading-relaxed text-[#ffd4dd]">
              {resetStep === 1
                ? "RESET ALL SAVED PROGRESS? ALL GASES, HELPERS, STATS AND PRESTIGE WILL BE LOST."
                : "FINAL WARNING: THIS CANNOT BE UNDONE. DELETE YOUR ENTIRE SAVE?"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onCancelReset}
                className="min-h-[44px] border border-white/40 bg-[#1b1233] font-bold text-white">CANCEL</button>
              <button type="button" onClick={resetStep === 1 ? onNextReset : onConfirmReset}
                className="min-h-[44px] border border-[#ff829b] bg-[#642139] font-bold text-white">
                {resetStep === 1 ? "CONFIRM 1 OF 2" : "DELETE SAVE · FINAL"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
