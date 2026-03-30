

import React, { useEffect, useRef, useState } from 'react';

interface SoundWavesProps {
  isActive: boolean;
  audioLevel: number; // 0..100
}

// Genera un path SVG usando curvas Bézier para una onda suave
function generateBezierWavePath({
  width,
  height,
  amplitude = 1,
  frequency = 1,
  phase = 0,
  points = 80,
  envelope = true,
}: {
  width: number;
  height: number;
  amplitude: number;
  frequency: number;
  phase: number;
  points?: number;
  envelope?: boolean;
}) {
  const midY = height / 2;
  const step = width / (points - 1);
  let d = '';
  let prev = { x: 0, y: midY };
  for (let i = 0; i < points; i++) {
    const x = i * step;
    // Envelope: atenuación tipo Gauss para que los extremos terminen en y=midY
    const env = envelope
      ? Math.exp(-0.5 * Math.pow((i - points / 2) / (points / 2.2), 2))
      : 1;
    const y = midY + Math.sin((i / points) * Math.PI * 2 * frequency + phase) * amplitude * env;
    if (i === 0) {
      d = `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      // Bézier cuadrática: control en el punto medio
      const cx = (prev.x + x) / 2;
      const cy = (prev.y + y) / 2;
      d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)}, ${cx.toFixed(2)} ${cy.toFixed(2)}`;
    }
    prev = { x, y };
  }
  // Termina en línea recta al final
  d += ` L ${width.toFixed(2)} ${midY.toFixed(2)}`;
  return d;
}

export default function SoundWaves({ isActive, audioLevel }: SoundWavesProps) {
  // SVG dimensions
  const width = 340;
  const height = 80;
  // Capas de onda mejoradas: más capas, más variedad visual
  const layers = [
    {
      amplitude: 20,
      frequency: 1.0,
      phaseShift: 0,
      strokeWidth: 2.6,
      dash: '',
      opacity: 1,
      filter: 'url(#glow)',
      gradient: 'url(#waveGradientMain)',
    },
    {
      amplitude: 15,
      frequency: 1.12,
      phaseShift: 0.7,
      strokeWidth: 1.7,
      dash: '7 7',
      opacity: 0.55,
      filter: 'url(#glow)',
      gradient: 'url(#waveGradientCyan)',
    },
    {
      amplitude: 11,
      frequency: 0.92,
      phaseShift: -0.6,
      strokeWidth: 1.2,
      dash: '3 6',
      opacity: 0.32,
      filter: 'url(#glow)',
      gradient: 'url(#waveGradientPurple)',
    },
    {
      amplitude: 7,
      frequency: 1.25,
      phaseShift: 1.2,
      strokeWidth: 0.9,
      dash: '2 8',
      opacity: 0.18,
      filter: 'url(#glow)',
      gradient: 'url(#waveGradientPink)',
    },
  ];

  const [phases, setPhases] = useState(Array(layers.length).fill(0));
  const [paths, setPaths] = useState<string[]>(Array(layers.length).fill(''));
  const audioLevelRef = useRef(audioLevel);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  // Animación de ondas mejorada
  useEffect(() => {
    let running = true;
    function animate() {
      if (!running) return;
      // El audioLevel modula la amplitud
      const level = Math.max(0.08, Math.min(1.7, 0.08 + audioLevelRef.current / 55));
      const now = performance.now();
      // Fases independientes para cada capa, con más variación y velocidad
      const newPhases = phases.map((p, i) =>
        p + 0.028 + i * 0.018 + Math.sin(now / (900 + i * 200)) * (0.012 + i * 0.004)
      );
      setPhases(newPhases);
      setPaths(
        layers.map((layer, i) =>
          generateBezierWavePath({
            width,
            height,
            amplitude: layer.amplitude * level * (isActive ? 1 : 0.13 + i * 0.04),
            frequency: layer.frequency + Math.sin(now / (1800 + i * 300)) * 0.08 + i * 0.04,
            phase: (newPhases[i] ?? 0) + layer.phaseShift,
            points: 90 + i * 14,
            envelope: true,
          })
        )
      );
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line
  }, [isActive]);

  return (
    <div className="flex items-center justify-center" style={{ width }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
        aria-hidden={!isActive}
      >
        <defs>
          {/* Gradientes para cada capa */}
          <linearGradient id="waveGradientMain" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a259ff" />
            <stop offset="50%" stopColor="#fff1f9" />
            <stop offset="100%" stopColor="#00ffe7" />
          </linearGradient>
          <linearGradient id="waveGradientCyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ffe7" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="waveGradientPurple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a259ff" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="waveGradientPink" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#fff1f9" />
          </linearGradient>
          {/* Filtro de resplandor */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {paths.map((d, i) => {
          const layer = layers[i] ?? {
            amplitude: 10,
            frequency: 1,
            phaseShift: 0,
            strokeWidth: 2,
            dash: '',
            opacity: 1,
            filter: undefined,
            gradient: 'url(#waveGradientMain)'
          };
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={layer.gradient}
              strokeWidth={layer.strokeWidth}
              strokeDasharray={layer.dash}
              strokeOpacity={layer.opacity}
              filter={layer.filter}
              style={{ transition: 'stroke-opacity 220ms' }}
            />
          );
        })}
      </svg>
    </div>
  );
}
