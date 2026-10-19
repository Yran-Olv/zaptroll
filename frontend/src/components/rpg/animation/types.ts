export type JointName =
  | 'head'
  | 'neck'
  | 'shoulder_l'
  | 'shoulder_r'
  | 'elbow_l'
  | 'elbow_r'
  | 'hand_l'
  | 'hand_r'
  | 'hip'
  | 'knee_l'
  | 'knee_r'
  | 'foot_l'
  | 'foot_r';

export interface Point2D {
  x: number;
  y: number;
}

export type RigPose = Record<JointName, Point2D>;

export type ActionName =
  | 'idle'
  | 'punch'
  | 'kick'
  | 'charge'
  | 'block'
  | 'dodge'
  | 'counter'
  | 'hit'
  | 'special'
  | 'summon'
  | 'ally_enter'
  | 'combo_punch'
  | 'buff'
  | 'debuff'
  | 'stunned'
  | 'taunt'
  | 'ko'
  | 'victory';

export interface AnimationFrame {
  t: number; // Milissegundos a partir do início da ação
  pose: string; // Nome da pose definida em default_rig.json
  png?: string; // Nome do arquivo PNG correspondente a este quadro
  move?: { x?: number; y?: number }; // Deslocamento local do lutador em coordenadas da arena
  impact?: boolean; // Se verdadeiro, este é o momento exato em que o dano e a vida se atualizam
  impactPoint?: JointName; // Articulação do ponto de impacto
  scale?: number; // Fator de escala / squash-and-stretch
  rotation?: number; // Rotação do corpo em graus
  opacity?: number;
}

export type ImpactEffectType =
  | 'hit_light'
  | 'hit_heavy'
  | 'hit_crit'
  | 'hit_blocked'
  | 'special_blast'
  | 'magic_burst';

export interface ActionConfig {
  png?: string;
  frames: AnimationFrame[];
  impactPoint?: JointName;
  impactEffect?: ImpactEffectType;
  shake?: number; // Intensidade da tremida da tela (0 a 15)
  hitstopMs?: number; // Duração do congelamento no impacto (hitstop)
  sound?: string;
  loop?: boolean;
}

export interface CharacterManifest {
  id: string;
  name: string;
  anchor: { x: number; y: number }; // Ponto de apoio nos pés (ex: { x: 0.5, y: 0.95 })
  scale: number;
  flip?: boolean;
  fallbackMode?: 'stick_figure' | 'png_transform';
  offsets?: Partial<Record<ActionName, { x: number; y: number; scale?: number }>>;
  hitbox?: { x: number; y: number; width: number; height: number };
  actions: Record<ActionName, ActionConfig>;
}

export interface DefaultRigConfig {
  version: string;
  viewBox: { width: number; height: number };
  anchor: { x: number; y: number };
  poses: Record<string, RigPose>;
  actions: Record<ActionName, ActionConfig>;
}

export interface ArenaFighterVisualState {
  side: 'p1' | 'p2';
  name: string;
  characterId: string;
  characterName: string;
  avatarEmoji?: string;
  maxHp: number;
  currentHp: number;
  displayedHp: number; // HP animado que só muda no momento exato do impacto
  maxEnergy: number;
  currentEnergy: number;
  popularity: number;
  action: ActionName;
  actionTimeMs: number;
  x: number; // Posição lógica X na arena (0 a 1000)
  y: number; // Posição lógica Y na arena (0 a 500)
  baseX: number; // Posição base de repouso
  baseY: number;
  targetX?: number; // Posição alvo ao avançar
  targetY?: number;
  flipX: boolean;
  isHit: boolean;
  isGuarding: boolean;
  activeStatuses: Array<{ type: string; duration: number }>;
  speechBubble?: { text: string; expiresAt: number } | null;
  auraEffect?: string | null;
}
