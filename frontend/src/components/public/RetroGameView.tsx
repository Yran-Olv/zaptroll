import React, { useEffect, useRef, useState } from 'react';
import { Gamepad2, Volume2, VolumeX, RotateCcw, ArrowLeft, Trophy, Shield, Flame, Zap, Share2, Sparkles } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  color: string;
  type: 'crawler' | 'demon' | 'boss';
}

export const RetroGameView: React.FC<{ gameId?: string }> = ({ gameId = 'doom-sector' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);

  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [autoFire, setAutoFire] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('zaptroll_doom_highscore') || '0', 10);
    } catch {
      return 0;
    }
  });

  const highScoreRef = useRef(highScore);
  const autoFireRef = useRef(autoFire);
  const logicalDimRef = useRef({ width: 360, height: 420, dpr: 1 });

  useEffect(() => {
    autoFireRef.current = autoFire;
  }, [autoFire]);

  // Audio Context synthesizer
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTone = (freq: number, type: OscillatorType, duration: number) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  const playLaser = () => playTone(880, 'sawtooth', 0.1);
  const playExplosion = () => playTone(120, 'square', 0.25);
  const playHit = () => playTone(220, 'triangle', 0.15);

  // Game state refs
  const stateRef = useRef({
    player: { x: 200, y: 300, vx: 0, vy: 0, speed: 4, radius: 14, angle: 0 },
    keys: { left: false, right: false, up: false, down: false, fire: false },
    touchMove: { x: 0, y: 0 },
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    lastSpawn: 0,
    lastFire: 0,
    score: 0,
    hp: 100,
    wave: 1,
    running: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      logicalDimRef.current = { width, height, dpr };

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (!gameStarted) {
        stateRef.current.player.x = width / 2;
        stateRef.current.player.y = height / 2;
      } else {
        // Clamp player within new bounds
        stateRef.current.player.x = Math.max(stateRef.current.player.radius, Math.min(width - stateRef.current.player.radius, stateRef.current.player.x));
        stateRef.current.player.y = Math.max(stateRef.current.player.radius, Math.min(height - stateRef.current.player.radius, stateRef.current.player.y));
      }
    };

    resize();
    window.addEventListener('resize', resize);

    let ro: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(containerRef.current);
    }

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = stateRef.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') k.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') k.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') k.up = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') k.down = true;
      if (e.key === ' ' || e.key === 'Enter') {
        k.fire = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = stateRef.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') k.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') k.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') k.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') k.down = false;
      if (e.key === ' ' || e.key === 'Enter') k.fire = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Main Game Loop
    const loop = (timestamp: number) => {
      const state = stateRef.current;
      const { width, height, dpr } = logicalDimRef.current;

      // Scale context for Retina display
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear Canvas
      ctx.fillStyle = '#080a0f';
      ctx.fillRect(0, 0, width, height);

      // Cyber Grid background
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 28;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (state.running) {
        // Update Player Movement
        let dx = 0;
        let dy = 0;
        if (state.keys.left) dx -= 1;
        if (state.keys.right) dx += 1;
        if (state.keys.up) dy -= 1;
        if (state.keys.down) dy += 1;
        if (state.touchMove.x !== 0 || state.touchMove.y !== 0) {
          dx = state.touchMove.x;
          dy = state.touchMove.y;
        }

        const len = Math.hypot(dx, dy);
        if (len > 0) {
          state.player.x += (dx / len) * state.player.speed;
          state.player.y += (dy / len) * state.player.speed;
          state.player.angle = Math.atan2(dy, dx);
        }

        // Clamp to screen bounds
        state.player.x = Math.max(state.player.radius, Math.min(width - state.player.radius, state.player.x));
        state.player.y = Math.max(state.player.radius, Math.min(height - state.player.radius, state.player.y));

        // Fire Bullet (Manual or Auto-Fire)
        const shouldFire = state.keys.fire || autoFireRef.current;
        if (shouldFire && timestamp - state.lastFire > 160) {
          state.lastFire = timestamp;
          const speed = 9;
          state.bullets.push({
            x: state.player.x,
            y: state.player.y,
            vx: Math.cos(state.player.angle) * speed,
            vy: Math.sin(state.player.angle) * speed,
            color: '#39ff14',
          });
          playLaser();
        }

        // Spawn Enemies
        if (timestamp - state.lastSpawn > Math.max(650, 2000 - state.wave * 140)) {
          state.lastSpawn = timestamp;
          const edge = Math.floor(Math.random() * 4);
          let ex = 0;
          let ey = 0;
          if (edge === 0) { ex = Math.random() * width; ey = -20; }
          else if (edge === 1) { ex = width + 20; ey = Math.random() * height; }
          else if (edge === 2) { ex = Math.random() * width; ey = height + 20; }
          else { ex = -20; ey = Math.random() * height; }

          const isDemon = Math.random() > 0.6;
          state.enemies.push({
            x: ex,
            y: ey,
            vx: 0,
            vy: 0,
            radius: isDemon ? 16 : 10,
            hp: isDemon ? 3 : 1,
            maxHp: isDemon ? 3 : 1,
            color: isDemon ? '#ef4444' : '#f97316',
            type: isDemon ? 'demon' : 'crawler',
          });
        }

        // Update Bullets
        for (let i = state.bullets.length - 1; i >= 0; i--) {
          const b = state.bullets[i];
          b.x += b.vx;
          b.y += b.vy;

          if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
            state.bullets.splice(i, 1);
            continue;
          }

          // Check Bullet collision with Enemies
          for (let j = state.enemies.length - 1; j >= 0; j--) {
            const e = state.enemies[j];
            const dist = Math.hypot(b.x - e.x, b.y - e.y);
            if (dist < e.radius + 4) {
              e.hp -= 1;
              state.bullets.splice(i, 1);

              // Spawn hit sparks
              for (let p = 0; p < 4; p++) {
                state.particles.push({
                  x: b.x,
                  y: b.y,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  radius: Math.random() * 2 + 1,
                  color: '#39ff14',
                  alpha: 1,
                  life: 15,
                });
              }

              if (e.hp <= 0) {
                // Enemy destroyed!
                state.enemies.splice(j, 1);
                state.score += e.type === 'demon' ? 50 : 20;
                setScore(state.score);

                // Update High Score
                if (state.score > highScoreRef.current) {
                  highScoreRef.current = state.score;
                  setHighScore(state.score);
                  try {
                    localStorage.setItem('zaptroll_doom_highscore', String(state.score));
                  } catch {}
                }

                // Wave advancement every 250 points
                if (Math.floor(state.score / 250) + 1 > state.wave) {
                  state.wave = Math.floor(state.score / 250) + 1;
                  setWave(state.wave);
                }

                playExplosion();
                // Explosion particles
                for (let p = 0; p < 12; p++) {
                  state.particles.push({
                    x: e.x,
                    y: e.y,
                    vx: (Math.random() - 0.5) * 8,
                    vy: (Math.random() - 0.5) * 8,
                    radius: Math.random() * 3 + 2,
                    color: e.color,
                    alpha: 1,
                    life: 25,
                  });
                }
              }
              break;
            }
          }
        }

        // Update Enemies
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          const e = state.enemies[i];
          const edx = state.player.x - e.x;
          const edy = state.player.y - e.y;
          const dist = Math.hypot(edx, edy);
          const spd = e.type === 'demon' ? 1.8 : 2.5;

          if (dist > 0) {
            e.x += (edx / dist) * spd;
            e.y += (edy / dist) * spd;
          }

          // Enemy touches player
          if (dist < state.player.radius + e.radius) {
            state.hp -= e.type === 'demon' ? 20 : 10;
            setHp(Math.max(0, state.hp));
            playHit();
            if (navigator.vibrate) navigator.vibrate(40);
            state.enemies.splice(i, 1);

            if (state.hp <= 0) {
              state.running = false;
              setGameOver(true);
            }
          }
        }

        // Update Particles
        for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 1 / p.life;
          if (p.alpha <= 0) {
            state.particles.splice(i, 1);
          }
        }
      }

      // Draw Particles
      for (const p of state.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Bullets
      for (const b of state.bullets) {
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Enemies
      for (const e of state.enemies) {
        ctx.save();
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();

        // Glowing center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Player
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      ctx.rotate(state.player.angle);

      // Ship body
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(state.player.radius + 4, 0);
      ctx.lineTo(-state.player.radius, -state.player.radius * 0.8);
      ctx.lineTo(-state.player.radius * 0.4, 0);
      ctx.lineTo(-state.player.radius, state.player.radius * 0.8);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationId);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted]);

  const startGame = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch {}

    stateRef.current.hp = 100;
    stateRef.current.score = 0;
    stateRef.current.wave = 1;
    stateRef.current.bullets = [];
    stateRef.current.enemies = [];
    stateRef.current.particles = [];
    stateRef.current.running = true;
    setHp(100);
    setScore(0);
    setWave(1);
    setGameOver(false);
    setGameStarted(true);
  };

  // Virtual Joystick & Touch Control Logic
  const updateThumbStick = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawDx = e.clientX - centerX;
    const rawDy = e.clientY - centerY;
    const maxRadius = rect.width * 0.34;

    const dist = Math.hypot(rawDx, rawDy);
    let clampedX = rawDx;
    let clampedY = rawDy;

    if (dist > maxRadius) {
      clampedX = (rawDx / dist) * maxRadius;
      clampedY = (rawDy / dist) * maxRadius;
    }

    setKnobPos({ x: clampedX, y: clampedY });

    if (dist > 5) {
      stateRef.current.touchMove = {
        x: clampedX / maxRadius,
        y: clampedY / maxRadius,
      };
    } else {
      stateRef.current.touchMove = { x: 0, y: 0 };
    }
  };

  const handlePadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (navigator.vibrate) navigator.vibrate(10);
    updateThumbStick(e);
  };

  const handlePadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    updateThumbStick(e);
  };

  const handlePadPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setKnobPos({ x: 0, y: 0 });
    stateRef.current.touchMove = { x: 0, y: 0 };
  };

  const handleTouchFire = (active: boolean) => {
    stateRef.current.keys.fire = active;
  };

  // Direct Touch on Canvas (Move towards touch position)
  const steerToCanvasTouch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const touchY = e.clientY - rect.top;

    const dx = touchX - stateRef.current.player.x;
    const dy = touchY - stateRef.current.player.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 12) {
      stateRef.current.touchMove = { x: dx / dist, y: dy / dist };
    } else {
      stateRef.current.touchMove = { x: 0, y: 0 };
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!gameStarted || gameOver) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    steerToCanvasTouch(e);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!gameStarted || gameOver) return;
    if (e.buttons === 0) return;
    steerToCanvasTouch(e);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    stateRef.current.touchMove = { x: 0, y: 0 };
  };

  const handleExitToWhatsApp = () => {
    try {
      if (window.opener) {
        window.close();
        return;
      }
    } catch {}

    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'whatsapp://app';
    }
  };

  const handleShareScore = () => {
    const text = `🕹️ *DOOM SECTOR • ZAPTROLL*\n🔥 Bati *${score} pontos* e sobrevivi até a Wave *${wave}*!\n\n🎮 Quem consegue bater meu recorde? Jogue agora:\n${window.location.href}`;
    window.location.href = `whatsapp://send?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#080a0f] text-white flex flex-col items-center justify-between p-2 select-none touch-none overflow-hidden pb-safe pt-safe">
      {/* 1. Header Superior */}
      <header className="flex-shrink-0 w-full max-w-lg flex items-center justify-between py-1.5 px-1 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-[#161922] border border-[#39ff14]/30 text-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.2)]">
            <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black font-mono tracking-wider text-white">
              DOOM SECTOR • ZAPTROLL
            </h1>
            <span className="text-[10px] text-gray-400 font-mono hidden xs:inline">WASM & Canvas Retro Arcade</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-[#161922] border border-white/10 text-gray-300 hover:text-white transition"
            title="Alternar Som"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#39ff14]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </header>

      {/* 2. HUD de Estatísticas */}
      <div className="flex-shrink-0 w-full max-w-lg flex items-center justify-between px-2 py-1 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-[#39ff14] font-bold">
          <Shield className="w-3.5 h-3.5" />
          <span>ESCUDO: {hp}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-yellow-400 font-bold">
          <Trophy className="w-3.5 h-3.5" />
          <span>SCORE: {score}</span>
        </div>
        {highScore > 0 && (
          <div className="hidden xs:flex items-center gap-1 text-amber-400">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span className="text-[10px]">REC: {highScore}</span>
          </div>
        )}
        <div className="text-cyan-400 font-bold">WAVE: {wave}</div>
      </div>

      {/* 3. Container do Canvas do Jogo */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg flex-1 min-h-0 flex items-center justify-center my-1 overflow-hidden rounded-2xl border border-white/10 bg-[#080a0f] shadow-[0_0_30px_rgba(57,255,20,0.1)]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          className="block cursor-crosshair touch-none"
        />

        {/* Overlay Inicial e de Game Over */}
        {(!gameStarted || gameOver) && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-in fade-in z-10 overflow-y-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#161922] border border-[#39ff14]/40 flex items-center justify-center text-2xl mb-2 shadow-[0_0_20px_rgba(57,255,20,0.3)]">
              {gameOver ? '💀' : '🔥'}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white font-mono mb-1.5 tracking-wider">
              {gameOver ? 'VOCÊ FOI DERROTADO' : 'DOOM SECTOR 2026'}
            </h2>

            <p className="text-xs text-gray-300 max-w-xs mb-3 font-sans">
              {gameOver
                ? `Pontuação Final: ${score} pts. Sobreviveu até a Wave ${wave}.`
                : 'Defenda a base cibernética! Use o D-pad virtual, arraste o dedo na tela ou use WASD.'}
            </p>

            {highScore > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono mb-4">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Recorde Pessoal: {highScore} pts</span>
              </div>
            )}

            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={startGame}
                className="w-full py-3 px-6 rounded-xl bg-[#39ff14] hover:bg-[#32e012] active:bg-[#28c50d] text-black font-extrabold text-sm shadow-[0_0_25px_rgba(57,255,20,0.4)] flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <RotateCcw className="w-4 h-4 text-black" />
                <span>{gameOver ? 'Jogar Novamente' : 'Iniciar Missão 🚀'}</span>
              </button>

              {gameOver && (
                <button
                  onClick={handleShareScore}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1caa52] text-white font-bold text-xs shadow-[0_0_15px_rgba(37,211,102,0.3)] flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartilhar no WhatsApp</span>
                </button>
              )}

              <button
                onClick={handleExitToWhatsApp}
                className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-mono transition"
              >
                ← Voltar ao Chat do WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Deck de Controles Mobile Táteis (100% visível, sem cortes) */}
      <div className="flex-shrink-0 w-full max-w-lg px-2 pt-1 pb-1">
        <div className="flex items-center justify-between gap-2">
          {/* Esquerda: D-Pad Analógico Virtual 360° com Indicadores Táteis */}
          <div
            ref={padRef}
            onPointerDown={handlePadPointerDown}
            onPointerMove={handlePadPointerMove}
            onPointerUp={handlePadPointerUp}
            onPointerCancel={handlePadPointerUp}
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#151924] to-[#0c0f16] border-2 border-white/15 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_0_15px_rgba(57,255,20,0.15)] flex items-center justify-center cursor-pointer select-none touch-none active:border-[#39ff14]/60 transition-colors"
          >
            {/* Linhas Guia Sutis */}
            <div className="absolute inset-x-3 top-1/2 h-[1px] bg-white/5 pointer-events-none" />
            <div className="absolute inset-y-3 left-1/2 w-[1px] bg-white/5 pointer-events-none" />

            {/* Marcadores de Direção */}
            <span
              className={`absolute top-1 text-[11px] font-black transition-colors ${
                knobPos.y < -12 ? 'text-[#39ff14] scale-125' : 'text-gray-500'
              }`}
            >
              ▲
            </span>
            <span
              className={`absolute bottom-1 text-[11px] font-black transition-colors ${
                knobPos.y > 12 ? 'text-[#39ff14] scale-125' : 'text-gray-500'
              }`}
            >
              ▼
            </span>
            <span
              className={`absolute left-1.5 text-[11px] font-black transition-colors ${
                knobPos.x < -12 ? 'text-[#39ff14] scale-125' : 'text-gray-500'
              }`}
            >
              ◀
            </span>
            <span
              className={`absolute right-1.5 text-[11px] font-black transition-colors ${
                knobPos.x > 12 ? 'text-[#39ff14] scale-125' : 'text-gray-500'
              }`}
            >
              ▶
            </span>

            {/* Manete / Botão Analógico Flutuante */}
            <div
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
                transition: knobPos.x === 0 && knobPos.y === 0 ? 'transform 0.15s ease-out' : 'none',
              }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1f2937] to-[#111827] border-2 border-[#39ff14] shadow-[0_0_14px_rgba(57,255,20,0.5)] flex items-center justify-center pointer-events-none"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-[#39ff14]/80 shadow-[0_0_6px_#39ff14]" />
            </div>
          </div>

          {/* Centro: Hub de Ações Rápidas (Voltar & Auto-Fire) */}
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={handleExitToWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161922] hover:bg-[#1e2330] active:bg-[#252c3c] border border-white/10 text-[11px] font-mono text-gray-300 hover:text-white transition shadow active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Voltar ao Chat</span>
            </button>

            <button
              onClick={() => setAutoFire(!autoFire)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-mono font-bold transition shadow active:scale-95 ${
                autoFire
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'bg-[#161922] border-white/10 text-gray-400 hover:text-gray-200'
              }`}
              title="Disparo Contínuo Automático"
            >
              <Zap className={`w-3.5 h-3.5 ${autoFire ? 'text-cyan-400 animate-pulse' : 'text-gray-500'}`} />
              <span>AUTO {autoFire ? 'ON' : 'OFF'}</span>
            </button>

            <span className="text-[9px] text-gray-500 font-mono tracking-tight text-center hidden xs:inline">
              Toque na tela ou no D-pad
            </span>
          </div>

          {/* Direita: Botão de Ação Arcade FIRE */}
          <div className="flex flex-col items-center justify-center">
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                handleTouchFire(true);
                if (navigator.vibrate) navigator.vibrate(15);
              }}
              onPointerUp={(e) => {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
                handleTouchFire(false);
              }}
              onPointerCancel={(e) => {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
                handleTouchFire(false);
              }}
              className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-gradient-to-br from-red-500 via-rose-600 to-red-700 active:from-red-600 active:to-red-800 text-white font-black font-mono text-sm sm:text-base border-4 border-red-400/40 shadow-[0_0_25px_rgba(239,68,68,0.5)] flex flex-col items-center justify-center active:scale-95 transition-transform"
            >
              <Flame className="w-5 h-5 text-yellow-300 animate-pulse mb-0.5" />
              <span className="tracking-wider">FIRE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
