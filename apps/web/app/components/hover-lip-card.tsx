"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

type LipStyle = CSSProperties & {
  "--lip-x"?: string;
  "--lip-y"?: string;
};

type HoverLipCardProps = {
  as?: "article" | "div";
  children: ReactNode;
  className?: string;
  innerClassName: string;
  style?: LipStyle;
};

const defaultLipPosition: LipStyle = {
  "--lip-x": "50%",
  "--lip-y": "50%"
};

function updateLipPosition(event: PointerEvent<HTMLElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();

  target.style.setProperty("--lip-x", `${event.clientX - rect.left}px`);
  target.style.setProperty("--lip-y", `${event.clientY - rect.top}px`);
}

export function HoverLipCard({ as = "div", children, className, innerClassName, style }: HoverLipCardProps) {
  const sharedProps = {
    className: cn("lip-hover-card", className),
    onPointerMove: updateLipPosition,
    style: { ...defaultLipPosition, ...style }
  };

  const content = <div className={cn("lip-hover-card__inner", innerClassName)}>{children}</div>;

  if (as === "article") {
    return <article {...sharedProps}>{content}</article>;
  }

  return <div {...sharedProps}>{content}</div>;
}
