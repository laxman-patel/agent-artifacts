"use client";

import { ShaderMount } from "@paper-design/shaders-react";
import {
  DitheringShapes,
  DitheringTypes,
  ShaderFitOptions,
  ditheringFragmentShader,
  getShaderColorFromString
} from "@paper-design/shaders";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type HeroDitherShaderProps = {
  backColor?: string;
  className?: string;
  fieldClassName?: string;
  frontColor?: string;
  speed?: number;
};

export function HeroDitherShader({
  backColor = "#111111",
  className,
  fieldClassName = "hero-shader-field",
  frontColor = "#FF570A",
  speed = 0.28
}: HeroDitherShaderProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const uniforms = useMemo(
    () => ({
      u_colorBack: getShaderColorFromString(backColor),
      u_colorFront: getShaderColorFromString(frontColor),
      u_shape: DitheringShapes.warp,
      u_type: DitheringTypes["8x8"],
      u_pxSize: 2,
      u_fit: ShaderFitOptions.cover,
      u_scale: 1.08,
      u_rotation: 192,
      u_offsetX: 0,
      u_offsetY: 0,
      u_originX: 0.5,
      u_originY: 0.5,
      u_worldWidth: 0,
      u_worldHeight: 0
    }),
    [backColor, frontColor]
  );

  return (
    <div
      className={cn(fieldClassName, "relative h-[18rem] w-full max-w-full overflow-hidden sm:h-[21rem] lg:h-full lg:max-w-none", className)}
      aria-label="Abstract dithered signal field"
    >
      <ShaderMount
        width="100%"
        height="100%"
        fragmentShader={ditheringFragmentShader}
        uniforms={uniforms}
        speed={reducedMotion ? 0 : speed}
        frame={reducedMotion ? 9400 : 0}
        minPixelRatio={1}
        maxPixelCount={900000}
        className="absolute inset-0"
      />
    </div>
  );
}
