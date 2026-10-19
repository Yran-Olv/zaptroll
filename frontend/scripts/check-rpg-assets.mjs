import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHARACTERS_DIR = path.resolve(__dirname, '../public/rpg/characters');
const RIG_FILE = path.resolve(__dirname, '../public/rpg/poses/default_rig.json');

const SEEDED_CHARACTERS = [
  { id: 'doutor_promessa', name: 'Doutor Promessa' },
  { id: 'dona_reforma', name: 'Dona Reforma' },
  { id: 'capitao_palanque', name: 'Capitão Palanque' },
  { id: 'lobista_sombrio', name: 'Lobista Sombrio' },
  { id: 'ex_tudo', name: 'O Ex-Tudo' },
  { id: 'militante_convicto', name: 'Militante Convicto' },
  { id: 'tecnocrata_frio', name: 'Tecnocrata Frio' },
];

const REQUIRED_ACTIONS = [
  'idle',
  'punch',
  'kick',
  'charge',
  'block',
  'dodge',
  'counter',
  'hit',
  'special',
  'summon',
  'ally_enter',
  'combo_punch',
  'buff',
  'debuff',
  'stunned',
  'taunt',
  'ko',
  'victory',
];

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parsePngDimensions(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    // PNG signature check
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
  } catch (err) {
    // Ignore read error
  }
  return null;
}

function checkAssets() {
  console.log('\n🔍 ========================================================');
  console.log('   ZAPTROLL RPG — VERIFICADOR DE ASSETS E MANIFESTOS DE LUTA');
  console.log('========================================================\n');

  // 1. Checar Rig Mestre
  if (!fs.existsSync(RIG_FILE)) {
    console.error(`❌ [ERRO] default_rig.json não encontrado em: ${RIG_FILE}`);
    process.exit(1);
  } else {
    try {
      const rig = JSON.parse(fs.readFileSync(RIG_FILE, 'utf-8'));
      const poseCount = Object.keys(rig.poses || {}).length;
      const actionCount = Object.keys(rig.actions || {}).length;
      console.log(`✅ [OK] default_rig.json carregado: ${poseCount} poses de esqueleto, ${actionCount} ações configuradas.`);
    } catch (e) {
      console.error(`❌ [ERRO] default_rig.json inválido: ${e.message}`);
      process.exit(1);
    }
  }

  ensureDirectoryExists(CHARACTERS_DIR);

  // 2. Provisionar manifestos padrão caso não existam
  for (const char of SEEDED_CHARACTERS) {
    const charDir = path.join(CHARACTERS_DIR, char.id);
    ensureDirectoryExists(charDir);
    const manifestPath = path.join(charDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      const defaultManifest = {
        id: char.id,
        name: char.name,
        anchor: { x: 0.5, y: 0.95 },
        scale: 1.0,
        fallbackMode: 'png_transform',
        offsets: {
          idle: { x: 0, y: 0, scale: 1.0 },
          punch: { x: 0, y: 0, scale: 1.0 },
          kick: { x: 0, y: 0, scale: 1.0 },
          block: { x: 0, y: 0, scale: 1.0 },
          dodge: { x: 0, y: 0, scale: 1.0 },
          special: { x: 0, y: 0, scale: 1.05 },
        },
        actions: REQUIRED_ACTIONS.reduce((acc, act) => {
          acc[act] = { png: `${act}.png` };
          return acc;
        }, {}),
      };
      fs.writeFileSync(manifestPath, JSON.stringify(defaultManifest, null, 2), 'utf-8');
      console.log(`📝 [CRIADO] Manifesto padrão criado para ${char.name} (${char.id})`);
    }
  }

  // 3. Varrer personagens e testar PNGs
  const charEntries = fs.readdirSync(CHARACTERS_DIR, { withFileTypes: true });
  let totalFoundPngs = 0;
  let totalMissingPngs = 0;

  console.log('\n📊 STATUS DOS PERSONAGENS E POSES:\n');

  for (const entry of charEntries) {
    if (!entry.isDirectory()) continue;
    const charId = entry.name;
    const charDir = path.join(CHARACTERS_DIR, charId);
    const manifestPath = path.join(charDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      console.warn(`⚠️ [AVISO] Pasta '${charId}' não possui manifest.json.`);
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (err) {
      console.error(`❌ [ERRO] JSON inválido em ${charId}/manifest.json: ${err.message}`);
      continue;
    }

    const found = [];
    const missing = [];
    const dimensionsMap = new Map();

    for (const action of REQUIRED_ACTIONS) {
      const declaredPng = manifest.actions?.[action]?.png || `${action}.png`;
      const pngPath = path.join(charDir, declaredPng);

      if (fs.existsSync(pngPath)) {
        found.push(declaredPng);
        const dims = parsePngDimensions(pngPath);
        if (dims) {
          const dimKey = `${dims.width}x${dims.height}`;
          dimensionsMap.set(dimKey, (dimensionsMap.get(dimKey) || 0) + 1);
        }
      } else {
        missing.push(declaredPng);
      }
    }

    totalFoundPngs += found.length;
    totalMissingPngs += missing.length;

    const completionPct = Math.round((found.length / REQUIRED_ACTIONS.length) * 100);
    const statusIcon = completionPct === 100 ? '🟢' : completionPct > 0 ? '🟡' : '⚪';

    console.log(`${statusIcon} 👔 ${manifest.name || charId} [${charId}]`);
    console.log(`   PNGs: ${found.length}/${REQUIRED_ACTIONS.length} (${completionPct}%) | Fallback: ${manifest.fallbackMode || 'stick_figure'}`);

    if (missing.length > 0) {
      console.log(`   🔸 Faltando (${missing.length}): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '...' : ''}`);
    }

    // Alerta de dimensões inconsistentes
    if (dimensionsMap.size > 1) {
      console.log(`   ⚠️ [ALERTA DE DIMENSÃO] Múltiplos tamanhos detectados: ${Array.from(dimensionsMap.entries()).map(([k, v]) => `${k} (${v}x)`).join(', ')}`);
    }

    console.log('');
  }

  console.log('--------------------------------------------------------');
  console.log(`📈 TOTAL DE PNGS DETECTADOS: ${totalFoundPngs}`);
  console.log(`🦴 TOTAL EM FALLBACK (ESQUELETO NEON): ${totalMissingPngs}`);
  console.log('--------------------------------------------------------');
  console.log('💡 DICA: Quando você colocar seus PNGs em frontend/public/rpg/characters/{id}/,');
  console.log('   o jogo passará a renderizar os PNGs automaticamente por cima do esqueleto.');
  console.log('   Para alinhar as articulações, abra a rota /rpg/admin/pose-editor.\n');
}

checkAssets();
