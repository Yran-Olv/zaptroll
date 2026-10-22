import React, { useEffect, useRef, useState } from 'react';
import { Gamepad2, Volume2, VolumeX, RotateCcw, ArrowLeft, Trophy, Shield } from 'lucide-react';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

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
      const container = canvas.parentElement;
      if (container) {
        const width = Math.min(container.clientWidth, 600);
        const height = Math.min(window.innerHeight - 180, 500);
        canvas.width = width;
        canvas.height = height;
        if (!gameStarted) {
          stateRef.current.player.x = width / 2;
          stateRef.current.player.y = height / 2;
        }
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Keyboard handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = stateRef.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a') k.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') k.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w') k.up = true;
      if (e.key === 'ArrowDown' || e.key === 's') k.down = true;
      if (e.key === ' ' || e.key === 'Enter') {
        k.fire = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = stateRef.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a') k.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') k.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w') k.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') k.down = false;
      if (e.key === ' ' || e.key === 'Enter') k.fire = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Main Game Loop
    const loop = (timestamp: number) => {
      const state = stateRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Clear Canvas
      ctx.fillStyle = '#080a0f';
      ctx.fillRect(0, 0, width, height);

      // Cyber Grid background
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 30;
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

        // Fire Bullet
        if (state.keys.fire && timestamp - state.lastFire > 160) {
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
        if (timestamp - state.lastSpawn > Math.max(700, 2000 - state.wave * 150)) {
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
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted]);

  const startGame = () => {
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

  // Touch control handlers
  const handleTouchDir = (dx: number, dy: number) => {
    stateRef.current.touchMove = { x: dx, y: dy };
  };

  const handleTouchStop = () => {
    stateRef.current.touchMove = { x: 0, y: 0 };
  };

  const handleTouchFire = (active: boolean) => {
    stateRef.current.keys.fire = active;
  };

  return (
    <div className="min-h-screen bg-[#080a0f] text-white flex flex-col items-center justify-between p-3 select-none touch-none">
      {/* Top Bar */}
      <header className="w-full max-w-lg flex items-center justify-between py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-[#161922] border border-[#39ff14]/30 text-[#39ff14]">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black font-mono tracking-wider text-white">
              DOOM SECTOR • ZAPTROLL
            </h1>
            <span className="text-[10px] text-gray-400 font-mono">WASM & Canvas Retro Arcade</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-[#161922] border border-white/10 text-gray-300 hover:text-white"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#39ff14]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </header>

      {/* Stats HUD */}
      <div className="w-full max-w-lg flex items-center justify-between px-2 py-1.5 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-[#39ff14]">
          <Shield className="w-3.5 h-3.5" />
          <span>ESCUDO: {hp}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-yellow-400">
          <Trophy className="w-3.5 h-3.5" />
          <span>SCORE: {score}</span>
        </div>
        <div className="text-cyan-400">WAVE: {wave}</div>
      </div>

      {/* Game Canvas Container */}
      <div className="relative w-full max-w-lg flex-1 flex items-center justify-center min-h-[300px]">
        <canvas
          ref={canvasRef}
          className="rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(57,255,20,0.15)] bg-[#080a0f] w-full"
        />

        {/* Start / Game Over Overlay */}
        {(!gameStarted || gameOver) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h2 className="text-2xl font-black text-white font-mono mb-2 tracking-wider">
              {gameOver ? '💀 VOCÊ FOI DERROTADO' : '🔥 DOOM SECTOR 2026'}
            </h2>
            <p className="text-xs text-gray-300 max-w-xs mb-4">
              {gameOver
                ? `Pontuação Final: ${score} pts. Sobreviveu até a Wave ${wave}.`
                : 'Defenda a base contra as hordas cibernéticas. Controles por toque na tela ou WASD + Espaço.'}
            </p>
            <button
              onClick={startGame}
              className="py-3 px-8 rounded-2xl bg-[#39ff14] hover:bg-[#32e012] text-black font-bold text-sm shadow-[0_0_20px_rgba(57,255,20,0.4)] flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{gameOver ? 'Jogar Novamente' : 'Iniciar Missão'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls HUD */}
      <div className="w-full max-w-lg flex items-center justify-between px-2 pt-2 pb-1">
        {/* Virtual D-pad */}
        <div className="grid grid-cols-3 gap-1.5 w-32 h-32">
          <div />
          <button
            onPointerDown={() => handleTouchDir(0, -1)}
            onPointerUp={handleTouchStop}
            className="rounded-xl bg-[#161922] active:bg-[#39ff14]/30 border border-white/10 text-white font-mono text-sm flex items-center justify-center shadow"
          >
            ▲
          </button>
          <div />
          <button
            onPointerDown={() => handleTouchDir(-1, 0)}
            onPointerUp={handleTouchStop}
            className="rounded-xl bg-[#161922] active:bg-[#39ff14]/30 border border-white/10 text-white font-mono text-sm flex items-center justify-center shadow"
          >
            ◀
          </button>
          <div className="rounded-xl bg-[#10131a] border border-white/5 flex items-center justify-center text-[10px] text-gray-500 font-mono">
            PAD
          </div>
          <button
            onPointerDown={() => handleTouchDir(1, 0)}
            onPointerUp={handleTouchStop}
            className="rounded-xl bg-[#161922] active:bg-[#39ff14]/30 border border-white/10 text-white font-mono text-sm flex items-center justify-center shadow"
          >
            ▶
          </button>
          <div />
          <button
            onPointerDown={() => handleTouchDir(0, 1)}
            onPointerUp={handleTouchStop}
            className="rounded-xl bg-[#161922] active:bg-[#39ff14]/30 border border-white/10 text-white font-mono text-sm flex items-center justify-center shadow"
          >
            ▼
          </button>
          <div />
        </div>

        {/* Info & Exit Button */}
        <div className="flex flex-col items-center gap-2">
          <a
            href="whatsapp://app"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161922] border border-white/10 text-[11px] font-mono text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Chat</span>
          </a>
          <span className="text-[9px] text-gray-500 font-mono">Zaptroll Touch Arena</span>
        </div>

        {/* Action Button: FIRE */}
        <div className="flex flex-col items-center justify-center">
          <button
            onPointerDown={() => handleTouchFire(true)}
            onPointerUp={() => handleTouchFire(false)}
            className="w-24 h-24 rounded-full bg-red-600 active:bg-red-500 text-white font-black font-mono text-base border-4 border-red-400/30 shadow-[0_0_25px_rgba(239,68,68,0.5)] flex items-center justify-center active:scale-95 transition-transform"
          >
            FIRE 🔥
          </button>
        </div>
      </div>
    </div>
  );
};
