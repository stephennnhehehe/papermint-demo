import Image from "next/image";

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Image alt={compact ? "PaperMint" : ""} height={44} priority src="/papermint-mark.svg" width={44} />
      {compact ? null : (
        <span className={`text-xl font-black tracking-normal ${inverse ? "text-white" : "text-[var(--foreground)]"}`}>
          PaperMint
        </span>
      )}
    </span>
  );
}
