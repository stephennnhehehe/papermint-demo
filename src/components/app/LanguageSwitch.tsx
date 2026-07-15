"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { languageOptions } from "@/lib/i18n";
import { useLanguage } from "./LanguageProvider";

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = languageOptions.find((option) => option.code === language) ?? languageOptions[0];

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" dir="ltr" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn-secondary min-h-[42px] px-3 py-2"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        title="Language"
        type="button"
      >
        <Globe2 className="h-4 w-4" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.shortLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-[var(--line)] bg-white p-1.5 shadow-[0_18px_45px_rgba(23,33,27,0.16)]"
          role="menu"
        >
          {languageOptions.map((option) => (
            <button
              className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-bold ${
                language === option.code
                  ? "bg-[#eaf6ef] text-[var(--mint-dark)]"
                  : "text-[var(--foreground)] hover:bg-[#f4f7f4]"
              }`}
              key={option.code}
              onClick={() => {
                setLanguage(option.code);
                setOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <span>{option.label}</span>
              {language === option.code ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
