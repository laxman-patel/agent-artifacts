import { useState, useEffect } from "react";

const PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#22c55e", "#06b6d4"];

function ConfettiDot({ color, delay }: { color: string; delay: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 800 + delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  const left = 20 + Math.random() * 60;
  const size = 6 + Math.random() * 8;

  return (
    <span
      style={{
        position: "absolute",
        left: `${left}%`,
        top: "50%",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        opacity: 0.85,
        animation: `float ${0.6 + Math.random() * 0.4}s ease-out forwards`,
        animationDelay: `${delay}ms`,
        pointerEvents: "none",
      }}
    />
  );
}

export default function AgentArtifactsDemo() {
  const [count, setCount] = useState(0);
  const [burst, setBurst] = useState(0);
  const color = PALETTE[count % PALETTE.length];

  function increment() {
    setCount((c) => c + 1);
    setBurst((b) => b + 1);
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) scale(1); opacity: 0.9; }
          100% { transform: translateY(-80px) scale(0.3); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
        }
      `}</style>

      <p
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#71717a",
          marginBottom: 8,
        }}
      >
        Agent Artifacts · JSX
      </p>

      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px", lineHeight: 1.2 }}>
        Hello from a hosted component
      </h1>

      <p style={{ color: "#a1a1aa", margin: "0 0 32px", fontSize: 15, lineHeight: 1.5 }}>
        This Preact component runs in a sandboxed iframe — published with{" "}
        <code style={{ color: "#e4e4e7", background: "#27272a", padding: "2px 6px", borderRadius: 4 }}>
          artifacts push
        </code>
        .
      </p>

      <div
        style={{
          position: "relative",
          background: "linear-gradient(145deg, #18181b 0%, #27272a 100%)",
          border: "1px solid #3f3f46",
          borderRadius: 16,
          padding: "32px 24px",
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <ConfettiDot key={`${burst}-${i}`} color={PALETTE[i % PALETTE.length]} delay={i * 40} />
        ))}

        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color,
            lineHeight: 1,
            marginBottom: 8,
            transition: "color 0.3s ease",
          }}
        >
          {count}
        </div>
        <div style={{ color: "#71717a", fontSize: 13, marginBottom: 24 }}>clicks so far</div>

        <button
          onClick={increment}
          style={{
            background: color,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "12px 28px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            transition: "transform 0.15s ease, background 0.3s ease",
            animation: count === 0 ? "pulse 2s infinite" : "none",
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          Click me
        </button>
      </div>

      <p style={{ fontSize: 13, color: "#52525b" }}>
        Hooks · default export · React-style imports → Preact compat
      </p>
    </div>
  );
}
