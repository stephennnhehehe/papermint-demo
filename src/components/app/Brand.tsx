import Image from "next/image";

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5" dir="ltr">
      <Image alt={compact ? "PaperMint" : ""} className="h-10 w-10 shrink-0" height={40} priority src="/papermint-mark.svg" width={40} />
      {compact ? null : (
        <span className={`shrink-0 whitespace-nowrap text-xl font-black leading-none tracking-normal ${inverse ? "text-white" : "text-[var(--foreground)]"}`}>
          PaperMint
        </span>
      )}
    </span>
  );
}
