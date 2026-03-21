import React from 'react';

interface SoundWavesProps {
  isActive: boolean;
  audioLevel: number;
}

export default function SoundWaves({ isActive, audioLevel }: SoundWavesProps) {
  return (
    <div className="flex items-center justify-center h-32 relative">
      <style>{`
        @keyframes wave1 {
          0%, 100% { height: 20px; }
          50% { height: 60px; }
        }
        @keyframes wave2 {
          0%, 100% { height: 20px; }
          50% { height: 80px; }
        }
        @keyframes wave3 {
          0%, 100% { height: 20px; }
          50% { height: 100px; }
        }
        @keyframes wave4 {
          0%, 100% { height: 20px; }
          50% { height: 80px; }
        }
        @keyframes wave5 {
          0%, 100% { height: 20px; }
          50% { height: 60px; }
        }
        .wave-bar {
          transition: all 0.1s ease;
          background: linear-gradient(to top, #4f46e5, #6366f1);
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
              width: '8px',
              height: isActive ? `${20 + (audioLevel * 0.8)}px` : '20px',
              animation: isActive ? `wave${i + 1} 0.5s ease-in-out infinite` : 'none',
              animationDelay: `${i * 0.1}s`,
              opacity: isActive ? 1 : 0.6,
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
