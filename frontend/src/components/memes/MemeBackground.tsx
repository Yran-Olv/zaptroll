import React from 'react';

interface MemeBackgroundProps {
  opacity?: number;
  className?: string;
}

export const MemeBackground: React.FC<MemeBackgroundProps> = ({
  opacity = 0.04,
  className = '',
}) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <svg
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="meme-lab-pattern"
            width="240"
            height="240"
            patternUnits="userSpaceOnUse"
          >
            {/* Trollface silhouette */}
            <path
              d="M30 50 C28 28 42 15 70 15 C95 15 106 28 106 48 C106 70 85 80 62 78 C42 76 32 66 30 50 Z"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <path
              d="M36 45 Q70 38 98 44 Q70 70 36 45"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            {/* Code Brackets */}
            <path
              d="M160 40 L145 55 L160 70"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M185 40 L200 55 L185 70"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Terminal prompt symbol */}
            <path
              d="M40 150 L55 165 L40 180"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="65"
              y1="180"
              x2="85"
              y2="180"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Pixel Sunglasses */}
            <rect x="140" y="150" width="22" height="10" fill="#ffffff" />
            <rect x="175" y="150" width="22" height="10" fill="#ffffff" />
            <rect x="162" y="152" width="13" height="3" fill="#ffffff" />
            {/* Rage comic lightning / speech tail */}
            <path
              d="M110 110 L125 125 L105 130 Z"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            {/* Subtle Grid Dot */}
            <circle cx="120" cy="120" r="1.5" fill="#ffffff" />
            <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            <circle cx="240" cy="0" r="1.5" fill="#ffffff" />
            <circle cx="0" cy="240" r="1.5" fill="#ffffff" />
            <circle cx="240" cy="240" r="1.5" fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#meme-lab-pattern)" />
      </svg>
    </div>
  );
};
