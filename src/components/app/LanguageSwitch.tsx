"use client";

import { useLanguage } from "./LanguageProvider";

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-grid grid-cols-2 rounded-lg border border-[var(--line)] bg-white/70 p-1">
      <button
        aria-pressed={language === "en"}
        className={`rounded-md px-3 py-1.5 text-sm font-bold ${
          language === "en" ? "bg-[var(--foreground)] text-white" : "text-[var(--muted)]"
        }`}
        onClick={() => setLanguage("en")}
        type="button"
      >
        EN
      </button>
      <button
        aria-pressed={language === "zh"}
        className={`rounded-md px-3 py-1.5 text-sm font-bold ${
          language === "zh" ? "bg-[var(--foreground)] text-white" : "text-[var(--muted)]"
        }`}
        onClick={() => setLanguage("zh")}
        type="button"
      >
        中
      </button>
    </div>
  );
}
