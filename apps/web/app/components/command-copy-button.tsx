"use client";

import { Check, ChevronRight, Copy } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

export function CommandCopyButton({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [command]);

  const Icon = copied ? Check : hovered ? Copy : ChevronRight;

  return (
    <button
      type="button"
      aria-label={`Copy command: ${command}`}
      onClick={handleCopy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative inline-flex h-10 items-center gap-2 rounded-none px-4 pr-5 font-mono text-sm font-medium text-foreground/85 transition-colors hover:text-foreground",
        className
      )}
    >
      <span
        className="absolute inset-0 opacity-[0.13] transition-opacity group-hover:opacity-[0.18]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 4px,
            currentColor 4px,
            currentColor 5px
          )`
        }}
      />
      <span className="absolute -left-[6px] -right-[6px] top-0 h-px bg-foreground/20 transition-colors group-hover:bg-foreground/30" />
      <span className="absolute -left-[6px] -right-[6px] bottom-0 h-px bg-foreground/20 transition-colors group-hover:bg-foreground/30" />
      <span className="absolute -bottom-[6px] -top-[6px] left-0 w-px bg-foreground/20 transition-colors group-hover:bg-foreground/30" />
      <span className="absolute -bottom-[6px] -top-[6px] right-0 w-px bg-foreground/20 transition-colors group-hover:bg-foreground/30" />
      <span className="relative flex size-4.5 items-center justify-center text-foreground/35 transition-colors group-hover:text-foreground/55">
        <Icon className="size-4" aria-hidden />
      </span>
      <code className="relative whitespace-nowrap">{command}</code>
    </button>
  );
}
