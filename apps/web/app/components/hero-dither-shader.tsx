"use client";

import { ShaderMount } from "@paper-design/shaders-react";
import {
  DitheringShapes,
  DitheringTypes,
  ShaderFitOptions,
  ditheringFragmentShader,
  getShaderColorFromString
} from "@paper-design/shaders";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

const cursorDitheringFragmentShader = ditheringFragmentShader
  .replace(
    "uniform vec4 u_colorFront;\nuniform float u_shape;",
    "uniform vec4 u_colorFront;\nuniform vec4 u_cursorColor;\nuniform sampler2D u_cursorMask;\nuniform vec2 u_cursor;\nuniform float u_cursorActive;\nuniform float u_walkPhase;\nuniform float u_walkAmount;\nuniform float u_walkFacing;\nuniform float u_shape;"
  )
  .replace(
    "int type = int(floor(u_type));",
    "vec2 cursorDelta = normalizedUV - u_cursor;\n  cursorDelta.x *= u_resolution.x / u_resolution.y;\n  vec2 cursorMaskUV = cursorDelta / 0.15 + 0.5;\n  vec2 maskLocal = cursorMaskUV - 0.5;\n\n  float stride = sin(u_walkPhase) * u_walkAmount;\n  float leftSwing = stride;\n  float rightSwing = -stride;\n  float leftLift = max(stride, 0.0);\n  float rightLift = max(-stride, 0.0);\n  float lower = 1.0 - smoothstep(-0.31, 0.02, maskLocal.y);\n  float foot = 1.0 - smoothstep(-0.46, -0.18, maskLocal.y);\n  float middle = smoothstep(-0.06, 0.09, maskLocal.y) * (1.0 - smoothstep(0.09, 0.35, maskLocal.y));\n  float outer = smoothstep(0.025, 0.15, abs(maskLocal.x));\n  float leftSide = 1.0 - step(0.0, maskLocal.x);\n  float rightSide = step(0.0, maskLocal.x);\n  float leftLeg = lower * outer * leftSide;\n  float rightLeg = lower * outer * rightSide;\n  float arms = middle * outer;\n\n  vec2 walkedMaskUV = cursorMaskUV;\n  walkedMaskUV.x -= u_walkFacing * 0.20 * (leftSwing * leftLeg + rightSwing * rightLeg) * (0.68 + 0.52 * foot);\n  walkedMaskUV.y += 0.105 * (leftLift * leftLeg + rightLift * rightLeg) * (0.45 + 0.85 * foot);\n  walkedMaskUV.x += u_walkFacing * 0.11 * stride * arms;\n  walkedMaskUV.y -= 0.025 * abs(stride) * middle;\n\n  float cursorMaskBounds = step(0.0, walkedMaskUV.x) * step(walkedMaskUV.x, 1.0) * step(0.0, walkedMaskUV.y) * step(walkedMaskUV.y, 1.0);\n  float cursorMask = cursorMaskBounds * step(0.5, texture(u_cursorMask, vec2(walkedMaskUV.x, 1.0 - walkedMaskUV.y)).a);\n  float cursorMix = u_cursorActive * cursorMask;\n  shape = clamp(shape + cursorMix * 0.22, 0.0, 1.0);\n\n  int type = int(floor(u_type));"
  )
  .replace(
    "vec3 fgColor = u_colorFront.rgb * u_colorFront.a;\n  float fgOpacity = u_colorFront.a;",
    "vec4 mixedFront = mix(u_colorFront, u_cursorColor, cursorMix);\n\n  vec3 fgColor = mixedFront.rgb * mixedFront.a;\n  float fgOpacity = mixedFront.a;"
  );

function randomMaskTarget() {
  return {
    x: -0.06 + Math.random() * 0.52,
    y: -0.32 + Math.random() * 0.64
  };
}

export function HeroDitherShader() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [maskImage, setMaskImage] = useState<HTMLImageElement | null>(null);
  const [maskPosition, setMaskPosition] = useState({ x: 0.22, y: 0.06 });
  const [walkState, setWalkState] = useState({ phase: 0, amount: 0, facing: 1 });
  const positionRef = useRef(maskPosition);
  const walkPhaseRef = useRef(0);
  const facingRef = useRef(1);
  const pointerRef = useRef(maskPosition);
  const randomTargetRef = useRef(randomMaskTarget());
  const isPointerInsideRef = useRef(false);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setMaskImage(image);
    image.src = "/brand/artifacts-logo.svg";
  }, []);

  useEffect(() => {
    if (reducedMotion || !maskImage) {
      setMaskPosition(positionRef.current);
      return;
    }

    let frameId = 0;

    const tick = (time: number) => {
      const lastFrame = lastFrameRef.current ?? time;
      const delta = Math.min(0.05, (time - lastFrame) / 1000);
      lastFrameRef.current = time;

      const position = positionRef.current;
      const target = isPointerInsideRef.current ? pointerRef.current : randomTargetRef.current;
      const dx = target.x - position.x;
      const dy = target.y - position.y;
      const distance = Math.hypot(dx, dy);
      const followStrength = isPointerInsideRef.current ? 7.5 : 0.72;
      const amount = 1 - Math.exp(-followStrength * delta);

      const previousX = position.x;
      const previousY = position.y;

      position.x += dx * amount;
      position.y += dy * amount;

      const velocity = Math.hypot(position.x - previousX, position.y - previousY) / Math.max(delta, 0.001);
      const walkAmount = Math.min(1.15, velocity * 5.4);
      if (walkAmount > 0.02) {
        walkPhaseRef.current += delta * (7.2 + walkAmount * 10.5);
      }
      const facing = Math.abs(position.x - previousX) > 0.0004 ? Math.sign(position.x - previousX) : facingRef.current;
      facingRef.current = facing;

      if (!isPointerInsideRef.current && distance < 0.025) {
        randomTargetRef.current = randomMaskTarget();
      }

      setMaskPosition({ x: position.x, y: position.y });
      setWalkState({ phase: walkPhaseRef.current, amount: walkAmount, facing });
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      lastFrameRef.current = null;
    };
  }, [maskImage, reducedMotion]);

  const uniforms = useMemo(
    () => ({
      u_colorBack: getShaderColorFromString("#111111"),
      u_colorFront: getShaderColorFromString("#c8c8c8"),
      u_cursorColor: getShaderColorFromString("#f28c28"),
      u_cursorMask: maskImage ?? "/brand/artifacts-logo.svg",
      u_cursor: [maskPosition.x, maskPosition.y],
      u_cursorActive: maskImage ? 1 : 0,
      u_walkPhase: walkState.phase,
      u_walkAmount: walkState.amount,
      u_walkFacing: walkState.facing,
      u_shape: DitheringShapes.warp,
      u_type: DitheringTypes["8x8"],
      u_pxSize: 2.65,
      u_fit: ShaderFitOptions.cover,
      u_scale: 0.54,
      u_rotation: 4,
      u_offsetX: 0.28,
      u_offsetY: -0.04,
      u_originX: 0.5,
      u_originY: 0.5,
      u_worldWidth: 0,
      u_worldHeight: 0
    }),
    [maskImage, maskPosition.x, maskPosition.y, walkState.amount, walkState.facing, walkState.phase]
  );

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = (event.clientX - rect.left) / rect.width;
    const localY = (event.clientY - rect.top) / rect.height;

    pointerRef.current = {
      // The shader's normalizedUV is centered at 0,0 and uses WebGL's
      // bottom-left Y origin, so map DOM coordinates into [-0.5, 0.5].
      x: localX - 0.5,
      y: 0.5 - localY
    };
  };

  return (
    <div
      className="hero-shader-field relative h-[18rem] w-full max-w-full overflow-hidden sm:h-[21rem] lg:h-full lg:max-w-none"
      aria-label="Abstract dithered signal field"
      onPointerEnter={(event) => {
        isPointerInsideRef.current = true;
        handlePointerMove(event);
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        isPointerInsideRef.current = false;
        randomTargetRef.current = randomMaskTarget();
      }}
    >
      <ShaderMount
        width="100%"
        height="100%"
        fragmentShader={cursorDitheringFragmentShader}
        uniforms={uniforms}
        speed={reducedMotion ? 0 : 0.1}
        frame={reducedMotion ? 9400 : 0}
        minPixelRatio={1}
        maxPixelCount={900000}
        className="absolute inset-0"
      />
    </div>
  );
}
