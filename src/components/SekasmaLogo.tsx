/** Reusable, subtle electric wordmark for header and Welcome Back. */
export default function SekasmaLogo({ big = false }: { big?: boolean }) {
  return (
    <div className="sekasma-logo inline-flex items-center justify-center gap-1" aria-label="Sekasma">
      <span className="sekasma-logo-volts text-[10px]" aria-hidden="true">⚡</span>
      <span className={`font-bold tracking-[0.24em] text-white ${big ? "text-[18px]" : "text-[12px]"}`}>SEKASMA</span>
      <span className="sekasma-logo-volts sekasma-logo-volts-delay text-[10px]" aria-hidden="true">⚡</span>
    </div>
  );
}
