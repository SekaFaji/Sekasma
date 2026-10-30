import type { ReactNode } from "react";

/** A non-interactive descriptive row (owned gases, future teasers). */
export default function InfoRow({
  name,
  sub,
  icon,
  color,
}: {
  name: string;
  sub: string;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <div className="flex w-full items-center gap-2 border border-white/10 bg-[#0d0820] px-2 py-1.5 text-left">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 bg-[#0b0618]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold leading-none" style={color ? { color } : undefined}>{name}</div>
        <div className="mt-0.5 truncate text-[10px] leading-tight text-white/40">{sub}</div>
      </div>
    </div>
  );
}
