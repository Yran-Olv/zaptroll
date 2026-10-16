import React, { useState } from 'react';
import { getDeterministicMeme, getMemeById, MemeItem } from './memeData.js';

interface MemeAvatarProps {
  memeId?: string;
  seed?: string;
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  glow?: boolean;
  statusOnline?: boolean;
}

export const MemeAvatar: React.FC<MemeAvatarProps> = ({
  memeId,
  seed,
  src,
  name,
  size = 'md',
  className = '',
  glow = false,
  statusOnline = false,
}) => {
  const [imageError, setImageError] = useState(false);

  // Pick meme
  let meme: MemeItem;
  if (memeId) {
    meme = getMemeById(memeId);
  } else if (seed || name) {
    meme = getDeterministicMeme(seed || name || 'zaptroll');
  } else {
    meme = getMemeById('trollface');
  }

  const SvgComponent = meme.component;

  // Dimensions
  const sizeMap = {
    sm: 'w-8 h-8 p-1',
    md: 'w-10 h-10 p-1.5',
    lg: 'w-12 h-12 p-2',
    xl: 'w-16 h-16 p-2.5',
  };

  const containerSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
  };

  const glowStyle = glow
    ? { boxShadow: `0 0 12px ${meme.color}40, inset 0 0 8px ${meme.color}20` }
    : undefined;

  return (
    <div className={`relative shrink-0 ${containerSizes[size]} ${className}`}>
      {src && !imageError ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          onError={() => setImageError(true)}
          className={`w-full h-full rounded-2xl object-cover border border-[#2a3346] bg-[#1a202c] shadow-sm`}
        />
      ) : (
        <div
          style={{
            borderColor: `${meme.color}55`,
            backgroundColor: '#161922',
            ...glowStyle,
          }}
          className={`${containerSizes[size]} rounded-2xl border flex items-center justify-center overflow-hidden transition-transform duration-200 hover:scale-105 shadow-sm group`}
          title={`${name || meme.name}: "${meme.quote}"`}
        >
          <div className="w-full h-full flex items-center justify-center p-0.5">
            <SvgComponent className="w-full h-full object-contain filter drop-shadow" />
          </div>
        </div>
      )}

      {/* Online indicator */}
      {statusOnline && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${dotSizes[size]} rounded-full bg-[#10b981] border-2 border-[#131722] shadow-[0_0_8px_#10b981]`}
          title="Online / Conectado"
        />
      )}
    </div>
  );
};
