import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActionName, JointName } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RIG_PATH = path.resolve(__dirname, '../../../../../public/rpg/poses/default_rig.json');
const CHARACTERS_DIR = path.resolve(__dirname, '../../../../../public/rpg/characters');

const ALL_18_ACTIONS: ActionName[] = [
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

const VALID_JOINTS: JointName[] = [
  'head',
  'neck',
  'shoulder_l',
  'shoulder_r',
  'elbow_l',
  'elbow_r',
  'hand_l',
  'hand_r',
  'hip',
  'knee_l',
  'knee_r',
  'foot_l',
  'foot_r',
];

describe('Validação do Rig Mestre e Manifestos de Poses', () => {
  it('deve carregar default_rig.json com estrutura e viewBox corretos', () => {
    expect(fs.existsSync(RIG_PATH)).toBe(true);
    const content = JSON.parse(fs.readFileSync(RIG_PATH, 'utf-8'));

    expect(content.version).toBeDefined();
    expect(content.viewBox).toEqual({ width: 140, height: 220 });
    expect(content.anchor).toEqual({ x: 70, y: 210 });
    expect(content.poses).toBeDefined();
    expect(content.actions).toBeDefined();
  });

  it('deve conter todas as 18 ações obrigatórias no default_rig.json', () => {
    const content = JSON.parse(fs.readFileSync(RIG_PATH, 'utf-8'));
    for (const action of ALL_18_ACTIONS) {
      expect(content.actions[action], `Ação '${action}' deve existir no rig`).toBeDefined();
      expect(content.actions[action].frames.length).toBeGreaterThan(0);
    }
  });

  it('todas as poses referenciadas nos quadros de animação devem existir em rig.poses', () => {
    const content = JSON.parse(fs.readFileSync(RIG_PATH, 'utf-8'));
    const declaredPoses = Object.keys(content.poses);

    for (const [actionName, actionConfig] of Object.entries<any>(content.actions)) {
      for (const frame of actionConfig.frames) {
        expect(
          declaredPoses,
          `Ação '${actionName}' referencia pose inexistente '${frame.pose}'`
        ).toContain(frame.pose);
      }
    }
  });

  it('todas as poses de esqueleto devem conter todas as 13 articulações obrigatórias', () => {
    const content = JSON.parse(fs.readFileSync(RIG_PATH, 'utf-8'));

    for (const [poseName, poseData] of Object.entries<any>(content.poses)) {
      for (const joint of VALID_JOINTS) {
        expect(
          poseData[joint],
          `Pose '${poseName}' está sem a articulação '${joint}'`
        ).toBeDefined();
        expect(typeof poseData[joint].x).toBe('number');
        expect(typeof poseData[joint].y).toBe('number');
      }
    }
  });

  it('pontos de impacto configurados devem ser articulações válidas', () => {
    const content = JSON.parse(fs.readFileSync(RIG_PATH, 'utf-8'));

    for (const [actionName, actionConfig] of Object.entries<any>(content.actions)) {
      if (actionConfig.impactPoint) {
        expect(
          VALID_JOINTS,
          `Ação '${actionName}' tem impactPoint inválido '${actionConfig.impactPoint}'`
        ).toContain(actionConfig.impactPoint);
      }
    }
  });

  it('todos os personagens devem ter manifest.json válido', () => {
    const dirs = fs.readdirSync(CHARACTERS_DIR, { withFileTypes: true });

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const manifestPath = path.join(CHARACTERS_DIR, dir.name, 'manifest.json');
      expect(fs.existsSync(manifestPath), `Manifesto de ${dir.name} deve existir`).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.id).toBe(dir.name);
      expect(manifest.anchor).toBeDefined();
      expect(manifest.scale).toBeGreaterThan(0);
      expect(manifest.actions).toBeDefined();
    }
  });
});
