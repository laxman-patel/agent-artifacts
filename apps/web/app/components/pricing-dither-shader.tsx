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

export function PricingDitherShader() {
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
      u_colorBack: getShaderColorFromString("#111111"),
      u_colorFront: getShaderColorFromString("#c8c8c8"),
      u_shape: DitheringShapes.warp,
      u_type: DitheringTypes["8x8"],
      u_pxSize: 2,
      u_fit: ShaderFitOptions.cover,
      u_scale: 1.14,
      u_rotation: 192,
      u_offsetX: 0.08,
      u_offsetY: -0.08,
      u_originX: 0.5,
      u_originY: 0.5,
      u_worldWidth: 0,
      u_worldHeight: 0
    }),
    []
  );

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-52 overflow-hidden rounded-t-[10px] opacity-30"
      style={{
        imageRendering: "pixelated",
        WebkitMaskImage: "linear-gradient(180deg, black 0%, rgb(0 0 0 / 0.82) 50%, rgb(0 0 0 / 0.18) 82%, transparent 100%)",
        maskImage: "linear-gradient(180deg, black 0%, rgb(0 0 0 / 0.82) 50%, rgb(0 0 0 / 0.18) 82%, transparent 100%)"
      }}
      aria-hidden
    >
      <ShaderMount
        width="100%"
        height="100%"
        fragmentShader={ditheringFragmentShader}
        uniforms={uniforms}
        speed={reducedMotion ? 0 : 0.2}
        frame={reducedMotion ? 9400 : 0}
        minPixelRatio={1}
        maxPixelCount={420000}
        className="absolute inset-0"
      />
    </div>
  );
}
