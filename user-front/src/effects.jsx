import { useEffect, useRef } from "react";

export function AuroraBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora-blob aurora-blob-one" />
      <span className="aurora-blob aurora-blob-two" />
      <span className="aurora-blob aurora-blob-three" />
      <ParticleField />
      <div className="grid-glow" />
    </div>
  );
}

export function ParticleField({ count = 34 }) {
  return (
    <div className="particle-field" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span
          className="particle"
          key={index}
          style={{
            "--x": `${(index * 29) % 100}%`,
            "--y": `${(index * 47) % 100}%`,
            "--delay": `${(index % 9) * -0.6}s`,
            "--size": `${3 + (index % 5)}px`,
          }}
        />
      ))}
    </div>
  );
}

export function SplitText({ text, as: Tag = "span", className = "" }) {
  return (
    <Tag className={`split-text ${className}`}>
      {text.split("").map((char, index) => (
        <span key={`${char}-${index}`} style={{ "--char-delay": `${index * 0.025}s` }}>
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </Tag>
  );
}

export function ShinyText({ children, className = "" }) {
  return <span className={`shiny-text ${className}`}>{children}</span>;
}

export function MagnetButton({ children, className = "", ...props }) {
  const ref = useRef(null);

  function handleMove(event) {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    element.style.setProperty("--magnet-x", `${x * 0.18}px`);
    element.style.setProperty("--magnet-y", `${y * 0.18}px`);
  }

  function handleLeave() {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--magnet-x", "0px");
    element.style.setProperty("--magnet-y", "0px");
  }

  return (
    <button
      ref={ref}
      className={`magnet-button ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...props}
    >
      <span>{children}</span>
    </button>
  );
}

export function SpotlightCard({ children, className = "", as: Tag = "article" }) {
  const ref = useRef(null);

  function handleMove(event) {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  return (
    <Tag ref={ref} className={`spotlight-card ${className}`} onMouseMove={handleMove}>
      {children}
    </Tag>
  );
}

export function TiltCard({ children, className = "", selected = false, onClick }) {
  const ref = useRef(null);

  function handleMove(event) {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    element.style.setProperty("--tilt-x", `${py * -7}deg`);
    element.style.setProperty("--tilt-y", `${px * 7}deg`);
  }

  function handleLeave() {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--tilt-x", "0deg");
    element.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <button
      ref={ref}
      className={`tilt-card ${selected ? "selected" : ""} ${className}`}
      type="button"
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
}

export function Reveal({ children, delay = 0, className = "" }) {
  return (
    <div className={`reveal ${className}`} style={{ "--reveal-delay": `${delay}s` }}>
      {children}
    </div>
  );
}

export function FlowTrail({ progress = 0 }) {
  return (
    <div className="flow-trail" aria-hidden="true">
      <span style={{ "--flow-width": `${Math.max(3, Math.min(100, progress))}%` }} />
    </div>
  );
}

export function OrbitalTargetMap({ proteins }) {
  const safeProteins = proteins.slice(0, 10);
  return (
    <div className="orbital-map" aria-label="Selected protein orbital map">
      <div className="orbital-core">
        <span>Q</span>
      </div>
      {safeProteins.map((protein, index) => (
        <span
          className="orbital-chip"
          key={protein.id}
          style={{
            "--orbit-angle": `${(index / Math.max(safeProteins.length, 1)) * 360}deg`,
            "--orbit-radius": `${98 + (index % 3) * 20}px`,
            "--orbit-delay": `${index * -0.45}s`,
          }}
        >
          {protein.gene}
        </span>
      ))}
    </div>
  );
}

export function useDocumentTier(tier) {
  useEffect(() => {
    document.documentElement.dataset.tier = tier || "student_free";
  }, [tier]);
}
