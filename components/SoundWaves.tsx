
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface SoundWavesProps {
  isActive: boolean;
  audioLevel: number; // 0..100
}

// Small helper: generate a smooth wave path from samples
function generateWavePath(samples: number[], height: number) {
  if (!samples || samples.length === 0) return '';
  const step = Math.max(1, Math.floor(samples.length / 60));
  const w = samples.length;
  let d = `M 0 ${height / 2 + samples[0]!.toFixed(2)}`;
  for (let i = 1; i < w; i += step) {
    const x = (i / (w - 1)) * 100; // percent-based
    const y = height / 2 + samples[i]!;
    d += ` L ${x} ${y.toFixed(2)}`;
  }
  return d;
}

export default function SoundWaves({ isActive, audioLevel }: SoundWavesProps) {
  const width = 360;
  const height = 96;
  const [paths, setPaths] = useState<string[]>(['', '', '']);
  const audioLevelRef = useRef<number>(audioLevel);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  // keep ref updated for animation loop
  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  // Generate waveform samples (sine + small noise) per-layer
  useEffect(() => {
    const layers = 3;
    let last = performance.now();

    function frame(now: number) {
      const dt = now - last;
      last = now;
      phaseRef.current += dt * 0.0025; // speed

      const levelFactor = Math.max(0.06, Math.min(3, 0.06 + audioLevelRef.current / 60));

      const newPaths: string[] = [];
      for (let l = 0; l < layers; l++) {
        const samples: number[] = [];
        const amp = (6 + l * 6) * levelFactor * (isActive ? 1 : 0.25);
        const freq = 0.9 + l * 0.35;
        const phase = phaseRef.current * (1 + l * 0.2);
        const jitter = 0.7 + l * 0.4;
        const points = 160;
        for (let i = 0; i < points; i++) {
          const x = (i / (points - 1)) * (width - 20) + 10;
          const t = (i / points) * Math.PI * 2 * freq + phase;
          // combination of sine + pseudo-noise
          const s = Math.sin(t) * amp * (1 + Math.sin(t * jitter) * 0.35);
          samples.push(s + height / 2);
        }
        const d = generateWavePath(samples, height);
        newPaths.push(d);
      }

      setPaths(newPaths);
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive]);

  // Colors & styles per layer
  const layerStyles = useMemo(
    () => [
      { stroke: 'rgba(99,102,241,0.95)', strokeWidth: 2.6, opacity: 1 },
      { stroke: 'rgba(59,130,246,0.65)', strokeWidth: 2, opacity: 0.8 },
      { stroke: 'rgba(139,92,246,0.45)', strokeWidth: 1.6, opacity: 0.6 },
    ],
    []
  );

  return (
    <div className="flex items-center justify-center" style={{ width }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
        aria-hidden={!isActive}
      >
        <defs>
          <linearGradient id="waveGrad" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i === 0 ? 'url(#waveGrad)' : layerStyles[i]!.stroke}
            strokeWidth={layerStyles[i]!.strokeWidth}
            strokeLinecap="round"
            style={{ opacity: isActive ? layerStyles[i]!.opacity : 0.18, transition: 'opacity 220ms' }}
            strokeDasharray={i === 2 ? '6 12' : undefined}
          />
        ))}

        {/* subtle glow when active */}
        {isActive && (
          <rect x="0" y="0" width="100%" height="100%" fill="none" />
        )}
      </svg>
    </div>
  );
}
