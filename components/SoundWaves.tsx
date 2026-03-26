
import React, { useMemo } from 'react';

interface SoundWavesProps {
  isActive: boolean;
  audioLevel: number;
}

export default function SoundWaves({ isActive, audioLevel }: SoundWavesProps) {
  // Genera alturas y animaciones realistas para cada barra
  const barHeights = useMemo(() => {
    // Simula una onda "rebotando" con pequeñas variaciones
    const base = Math.max(10, Math.min(audioLevel, 100));
    const spread = [1, 0.7, 0.5, 0.7, 1];
    return spread.map((factor, i) => {
      // Rebote aleatorio para simular vibración
      const bounce = isActive ? (Math.sin(Date.now() / (120 + i * 30)) * 8) : 0;
      return 20 + base * factor + bounce;
    });
  }, [audioLevel, isActive]);

  return (
    <div className="flex items-center justify-center h-32 relative">
      <style>{`
        .wave-bar {
          transition: height 0.13s cubic-bezier(.4,2,.6,1), box-shadow 0.2s;
          background: linear-gradient(to top, #4f46e5, #6366f1);
          box-shadow: 0 0 8px 0 #6366f1aa;
        }
        .wave-bar:hover {
          filter: brightness(1.2);
        }
      `}</style>

      <div className="flex items-center justify-center gap-1.5 h-full">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="wave-bar rounded-full"
            style={{
              width: '10px',
              height: isActive ? `${barHeights[i]}px` : '20px',
              opacity: isActive ? 1 : 0.6,
              boxShadow: isActive ? `0 0 ${8 + audioLevel / 10}px #6366f1aa` : undefined,
            }}
          />
        ))}
      </div>

      {/* Glow effect */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 blur-3xl -z-10"
          style={{
            opacity: 0.1 + (audioLevel / 100) * 0.3,
          }}
        />
      )}
    </div>
  );
}
