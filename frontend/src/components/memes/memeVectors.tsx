import React from 'react';

export interface MemeSvgProps {
  className?: string;
  size?: number | string;
}

// 1. Trollface ("Problem?")
export const TrollfaceSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Head Outline */}
    <path
      d="M20 95 C15 45 45 15 105 15 C160 15 185 45 185 85 C185 130 145 150 95 150 C50 150 25 130 20 95 Z"
      fill="#ffffff"
      stroke="#111827"
      strokeWidth="5"
    />
    {/* Forehead wrinkles */}
    <path d="M65 30 Q100 22 135 30" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
    <path d="M70 38 Q100 32 130 38" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
    {/* Left Eye & Crinkles */}
    <path d="M48 55 Q60 48 72 58" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="60" cy="62" r="4" fill="#111827" />
    <path d="M42 62 Q50 68 55 72" stroke="#111827" strokeWidth="2.5" />
    {/* Right Eye & Crinkles */}
    <path d="M120 56 Q135 48 150 54" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
    <circle cx="136" cy="60" r="4" fill="#111827" />
    <path d="M148 62 Q142 68 138 72" stroke="#111827" strokeWidth="2.5" />
    {/* Nose */}
    <path d="M96 60 Q104 74 92 78 Q102 78 106 72" stroke="#111827" strokeWidth="3" fill="none" />
    {/* Giant Mischievous Troll Grin */}
    <path
      d="M32 82 C65 72 135 68 172 78 C175 118 135 142 90 140 C52 138 30 115 32 82 Z"
      fill="#f8fafc"
      stroke="#111827"
      strokeWidth="4"
    />
    {/* Teeth Lines */}
    <path d="M34 88 C70 82 130 80 170 86" stroke="#111827" strokeWidth="3" />
    <path d="M38 112 C72 122 128 122 165 106" stroke="#111827" strokeWidth="2.5" />
    {/* Tooth Dividers */}
    <path d="M52 86 L50 115" stroke="#111827" strokeWidth="2.5" />
    <path d="M68 85 L67 122" stroke="#111827" strokeWidth="2.5" />
    <path d="M85 83 L84 126" stroke="#111827" strokeWidth="2.5" />
    <path d="M103 83 L103 126" stroke="#111827" strokeWidth="2.5" />
    <path d="M122 84 L123 123" stroke="#111827" strokeWidth="2.5" />
    <path d="M140 85 L143 118" stroke="#111827" strokeWidth="2.5" />
    <path d="M156 87 L158 108" stroke="#111827" strokeWidth="2.5" />
    {/* Cheek Crinkles */}
    <path d="M26 80 Q18 90 28 102" stroke="#111827" strokeWidth="3" fill="none" />
    <path d="M174 74 Q184 85 176 96" stroke="#111827" strokeWidth="3" fill="none" />
  </svg>
);

// 2. Me Gusta
export const MeGustaSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Round Head */}
    <circle cx="90" cy="90" r="75" fill="#ffffff" stroke="#111827" strokeWidth="5" />
    {/* Bulging Bloodshot Eyes */}
    <circle cx="62" cy="72" r="24" fill="#ffffff" stroke="#111827" strokeWidth="4" />
    <circle cx="62" cy="72" r="8" fill="#111827" />
    <path d="M48 68 Q54 70 56 68" stroke="#ef4444" strokeWidth="1.5" />
    <path d="M66 64 Q68 70 74 72" stroke="#ef4444" strokeWidth="1.5" />

    <circle cx="118" cy="72" r="24" fill="#ffffff" stroke="#111827" strokeWidth="4" />
    <circle cx="118" cy="72" r="8" fill="#111827" />
    <path d="M108 68 Q112 70 114 68" stroke="#ef4444" strokeWidth="1.5" />
    <path d="M124 64 Q126 70 132 72" stroke="#ef4444" strokeWidth="1.5" />

    {/* Eyebrows arching */}
    <path d="M42 46 Q62 42 80 50" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
    <path d="M100 50 Q118 42 138 46" stroke="#111827" strokeWidth="4" strokeLinecap="round" />

    {/* Big Puffy Cheeks */}
    <path d="M35 105 Q55 125 75 110" stroke="#111827" strokeWidth="3" fill="none" />
    <path d="M105 110 Q125 125 145 105" stroke="#111827" strokeWidth="3" fill="none" />

    {/* Tiny pursed mouth */}
    <path d="M78 128 Q90 138 102 128" stroke="#111827" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M84 136 Q90 142 96 136" stroke="#111827" strokeWidth="2.5" fill="none" />

    {/* Double Chin */}
    <path d="M65 148 Q90 160 115 148" stroke="#111827" strokeWidth="3" fill="none" />
  </svg>
);

// 3. Rage Guy (FFFUUU-)
export const RageGuySvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Distorted Head */}
    <path
      d="M25 80 C20 30 50 15 95 15 C145 15 165 40 160 90 C155 145 130 165 90 165 C45 165 30 130 25 80 Z"
      fill="#ffffff"
      stroke="#111827"
      strokeWidth="5"
    />
    {/* Angry Eyes */}
    <path d="M45 55 L75 65" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
    <circle cx="58" cy="72" r="9" fill="#111827" />
    <path d="M135 55 L105 65" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
    <circle cx="122" cy="72" r="9" fill="#111827" />

    {/* Stress lines forehead */}
    <path d="M80 30 L80 48" stroke="#ef4444" strokeWidth="3" />
    <path d="M90 28 L90 50" stroke="#ef4444" strokeWidth="3" />
    <path d="M100 32 L100 48" stroke="#ef4444" strokeWidth="3" />

    {/* Screaming Clenched Mouth */}
    <rect x="42" y="95" width="96" height="50" rx="10" fill="#111827" stroke="#111827" strokeWidth="4" />
    {/* Clenched Teeth Grid */}
    <path d="M44 120 L136 120" stroke="#ffffff" strokeWidth="4" />
    <path d="M60 96 L60 144" stroke="#ffffff" strokeWidth="3" />
    <path d="M78 96 L78 144" stroke="#ffffff" strokeWidth="3" />
    <path d="M96 96 L96 144" stroke="#ffffff" strokeWidth="3" />
    <path d="M114 96 L114 144" stroke="#ffffff" strokeWidth="3" />

    {/* Rage Spittle / Vein */}
    <path d="M142 85 Q152 75 160 82" stroke="#ef4444" strokeWidth="3" fill="none" />
  </svg>
);

// 4. Forever Alone
export const ForeverAloneSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Lumpy Potato Head */}
    <path
      d="M35 100 C25 50 55 18 100 18 C145 18 165 60 155 110 C145 155 125 168 85 165 C55 162 45 140 35 100 Z"
      fill="#ffffff"
      stroke="#111827"
      strokeWidth="5"
    />
    {/* Sagging sad eyebrows */}
    <path d="M50 68 Q65 60 75 72" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M105 72 Q115 60 130 68" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
    {/* Sad round eyes with teardrop */}
    <circle cx="62" cy="78" r="7" fill="#111827" />
    <circle cx="118" cy="78" r="7" fill="#111827" />
    {/* Big Tear */}
    <path d="M54 88 C50 98 62 105 64 94 C64 90 58 88 54 88 Z" fill="#38bdf8" />

    {/* Bulbous Wrinkled Chin */}
    <path d="M55 115 Q90 98 125 115" stroke="#111827" strokeWidth="3.5" fill="none" />
    <path d="M70 135 Q90 148 110 135" stroke="#111827" strokeWidth="2.5" fill="none" />
    <path d="M85 145 Q90 152 95 145" stroke="#111827" strokeWidth="2" fill="none" />
  </svg>
);

// 5. LOL Face
export const LolFaceSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Tilted oval head */}
    <ellipse cx="90" cy="90" rx="72" ry="74" fill="#ffffff" stroke="#111827" strokeWidth="5" />
    {/* Squeezed laughing eyes (Crescents) */}
    <path d="M45 70 Q62 55 78 70" stroke="#111827" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M102 70 Q118 55 135 70" stroke="#111827" strokeWidth="4" strokeLinecap="round" fill="none" />
    {/* Laughing teardrops */}
    <path d="M38 78 Q30 88 42 90 Z" fill="#38bdf8" />
    <path d="M142 78 Q150 88 138 90 Z" fill="#38bdf8" />

    {/* Enormous Laughing Mouth */}
    <path
      d="M38 88 C50 148 130 148 142 88 Z"
      fill="#b91c1c"
      stroke="#111827"
      strokeWidth="4"
    />
    {/* Upper Teeth */}
    <path d="M42 88 L138 88 L134 100 L46 100 Z" fill="#ffffff" stroke="#111827" strokeWidth="2" />
    <path d="M65 88 L65 100" stroke="#111827" strokeWidth="1.5" />
    <path d="M90 88 L90 100" stroke="#111827" strokeWidth="1.5" />
    <path d="M115 88 L115 100" stroke="#111827" strokeWidth="1.5" />

    {/* Tongue */}
    <ellipse cx="90" cy="130" rx="25" ry="12" fill="#f87171" />
  </svg>
);

// 6. Y U NO Guy
export const YunoGuySvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Round Head with furrowed brow */}
    <circle cx="90" cy="90" r="70" fill="#ffffff" stroke="#111827" strokeWidth="5" />
    {/* Angry wrinkles in forehead */}
    <path d="M60 40 Q90 30 120 40" stroke="#111827" strokeWidth="3" />
    <path d="M68 48 Q90 40 112 48" stroke="#111827" strokeWidth="2.5" />
    {/* Slanted Eyes */}
    <path d="M52 64 L74 72" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
    <circle cx="64" cy="74" r="5" fill="#111827" />
    <path d="M128 64 L106 72" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
    <circle cx="116" cy="74" r="5" fill="#111827" />

    {/* Shouting O Mouth with teeth */}
    <ellipse cx="90" cy="115" rx="30" ry="24" fill="#111827" stroke="#111827" strokeWidth="3" />
    <path d="M72 105 Q90 112 108 105" stroke="#ffffff" strokeWidth="4" />
    <path d="M75 125 Q90 118 105 125" stroke="#ffffff" strokeWidth="4" />

    {/* Shouting Arm Posture Left & Right */}
    <path d="M25 155 L45 130 L60 145" stroke="#111827" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M155 155 L135 130 L120 145" stroke="#111827" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 7. Challenge Accepted
export const ChallengeAcceptedSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Head tilted upward */}
    <path
      d="M40 85 C35 45 60 25 105 25 C145 25 155 55 150 95 C145 135 120 155 90 155 C55 155 45 125 40 85 Z"
      fill="#ffffff"
      stroke="#111827"
      strokeWidth="5"
    />
    {/* Narrowed determined eyes */}
    <path d="M60 62 L80 64" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
    <path d="M105 64 L125 62" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
    {/* Smug resolute mouth */}
    <path d="M70 108 Q100 120 125 102" stroke="#111827" strokeWidth="4" strokeLinecap="round" fill="none" />
    {/* Chin tilt shadow */}
    <path d="M75 132 Q95 142 115 132" stroke="#111827" strokeWidth="2.5" fill="none" />
    {/* Folded Arms Stick Lines */}
    <path d="M35 165 L90 155 L145 165" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
  </svg>
);

// 8. Derp (Cross-eyed & silly)
export const DerpSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Round Derp Head */}
    <circle cx="90" cy="90" r="70" fill="#ffffff" stroke="#111827" strokeWidth="5" />
    {/* Cross Eyes (Pupils looking towards nose) */}
    <circle cx="60" cy="72" r="16" fill="#ffffff" stroke="#111827" strokeWidth="3.5" />
    <circle cx="70" cy="72" r="6" fill="#111827" />

    <circle cx="120" cy="72" r="16" fill="#ffffff" stroke="#111827" strokeWidth="3.5" />
    <circle cx="110" cy="72" r="6" fill="#111827" />

    {/* Derp Goofy Smile with tongue */}
    <path d="M50 110 Q90 145 130 110" stroke="#111827" strokeWidth="4" fill="#ffffff" strokeLinecap="round" />
    <path d="M80 122 C80 140 100 140 100 122 Z" fill="#f43f5e" stroke="#111827" strokeWidth="2" />
  </svg>
);

// 9. Derpina (Derp + Pink Ribbon)
export const DerpinaSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Pink Ribbon Bow on top */}
    <path d="M40 28 L60 40 L40 52 Z" fill="#ec4899" stroke="#be185d" strokeWidth="2" />
    <path d="M80 28 L60 40 L80 52 Z" fill="#ec4899" stroke="#be185d" strokeWidth="2" />
    <circle cx="60" cy="40" r="6" fill="#f472b6" stroke="#be185d" strokeWidth="2" />

    {/* Head */}
    <circle cx="90" cy="95" r="65" fill="#ffffff" stroke="#111827" strokeWidth="5" />
    {/* Cross Eyes with Eyelashes */}
    <path d="M45 70 L40 64" stroke="#111827" strokeWidth="2.5" />
    <path d="M55 64 L53 58" stroke="#111827" strokeWidth="2.5" />
    <circle cx="62" cy="80" r="14" fill="#ffffff" stroke="#111827" strokeWidth="3" />
    <circle cx="70" cy="80" r="5" fill="#111827" />

    <path d="M125 64 L127 58" stroke="#111827" strokeWidth="2.5" />
    <path d="M135 70 L140 64" stroke="#111827" strokeWidth="2.5" />
    <circle cx="118" cy="80" r="14" fill="#ffffff" stroke="#111827" strokeWidth="3" />
    <circle cx="110" cy="80" r="5" fill="#111827" />

    {/* Sweet Derp Smile */}
    <path d="M58 115 Q90 145 122 115" stroke="#111827" strokeWidth="3.5" fill="#ffffff" strokeLinecap="round" />
    <circle cx="50" cy="110" r="6" fill="#fbcfe8" opacity="0.8" />
    <circle cx="130" cy="110" r="6" fill="#fbcfe8" opacity="0.8" />
  </svg>
);

// 10. Wojak / Feels Guy
export const WojakSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Smooth bald Wojak skull */}
    <path
      d="M32 90 C30 45 60 18 105 18 C145 18 160 50 155 95 C150 135 125 162 88 160 C52 158 35 130 32 90 Z"
      fill="#ffffff"
      stroke="#111827"
      strokeWidth="4.5"
    />
    {/* Melancholic heavy brow */}
    <path d="M52 65 Q70 60 82 68" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
    <path d="M102 68 Q115 60 132 65" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
    {/* Sad heavy eyelids */}
    <path d="M58 76 Q68 70 78 76" stroke="#111827" strokeWidth="3" fill="none" />
    <circle cx="68" cy="80" r="4" fill="#111827" />

    <path d="M106 76 Q116 70 126 76" stroke="#111827" strokeWidth="3" fill="none" />
    <circle cx="116" cy="80" r="4" fill="#111827" />

    {/* Nose curve */}
    <path d="M92 78 L95 102 L86 106" stroke="#111827" strokeWidth="3" fill="none" strokeLinecap="round" />

    {/* Slight sorrowful lip line */}
    <path d="M72 125 Q92 120 114 125" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <path d="M85 138 Q95 142 105 138" stroke="#111827" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

// 11. Cereal Guy
export const CerealGuySvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Stick Figure Head */}
    <circle cx="85" cy="55" r="35" fill="#ffffff" stroke="#111827" strokeWidth="4.5" />
    {/* Skeptical Eyes */}
    <circle cx="75" cy="50" r="4" fill="#111827" />
    <circle cx="95" cy="50" r="4" fill="#111827" />
    {/* Chewing Mouth */}
    <path d="M72 68 Q85 75 98 68" stroke="#111827" strokeWidth="3" fill="none" />

    {/* Stick body & arm holding spoon */}
    <path d="M85 90 L85 140" stroke="#111827" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M85 105 L115 115 L125 90" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
    {/* Spoon */}
    <ellipse cx="127" cy="85" rx="6" ry="9" fill="#94a3b8" stroke="#111827" strokeWidth="2" />

    {/* Cereal Bowl */}
    <path d="M45 135 C45 160 125 160 125 135 Z" fill="#38bdf8" stroke="#111827" strokeWidth="4" />
    {/* Spilled Cereal Bits */}
    <circle cx="108" cy="72" r="3" fill="#fbbf24" />
    <circle cx="118" cy="78" r="3" fill="#fbbf24" />
    <circle cx="125" cy="70" r="3" fill="#fbbf24" />
  </svg>
);

// 12. Deal With It (8-bit Sunglasses on Troll)
export const DealWithItSvg: React.FC<MemeSvgProps> = ({ className = 'w-10 h-10', size }) => (
  <svg
    viewBox="0 0 200 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={size ? { width: size, height: size } : undefined}
  >
    {/* Base Trollface */}
    <path
      d="M20 95 C15 45 45 15 105 15 C160 15 185 45 185 85 C185 130 145 150 95 150 C50 150 25 130 20 95 Z"
      fill="#ffffff"
      stroke="#111827"
      strokeWidth="5"
    />
    <path
      d="M32 82 C65 72 135 68 172 78 C175 118 135 142 90 140 C52 138 30 115 32 82 Z"
      fill="#f8fafc"
      stroke="#111827"
      strokeWidth="4"
    />
    <path d="M34 88 C70 82 130 80 170 86" stroke="#111827" strokeWidth="3" />
    <path d="M52 86 L50 115" stroke="#111827" strokeWidth="2.5" />
    <path d="M75 85 L74 124" stroke="#111827" strokeWidth="2.5" />
    <path d="M103 83 L103 126" stroke="#111827" strokeWidth="2.5" />
    <path d="M130 85 L132 120" stroke="#111827" strokeWidth="2.5" />
    <path d="M156 87 L158 108" stroke="#111827" strokeWidth="2.5" />

    {/* Pixel Sunglasses (Deal With It) */}
    <g fill="#111827">
      <rect x="42" y="48" width="46" height="20" rx="2" />
      <rect x="112" y="48" width="46" height="20" rx="2" />
      <rect x="88" y="52" width="24" height="6" />
      {/* 8-bit White Glare */}
      <rect x="46" y="52" width="8" height="6" fill="#ffffff" />
      <rect x="56" y="58" width="8" height="6" fill="#ffffff" />
      <rect x="116" y="52" width="8" height="6" fill="#ffffff" />
      <rect x="126" y="58" width="8" height="6" fill="#ffffff" />
    </g>
  </svg>
);
