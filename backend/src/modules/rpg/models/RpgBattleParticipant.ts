import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export interface ActiveStatusEffect {
  type: string; // 'fake_news' | 'cpi' | 'cancelamento' | 'escandalo' | 'blindagem' | 'furia' | 'atordoado'
  duration: number; // Em turnos
  potency: number;
}

export interface RpgBattleParticipantAttributes {
  id: string;
  battleId: string;
  playerId?: string | null;
  phone?: string | null;
  name: string;
  isBot: boolean;
  botDifficulty?: 'facil' | 'normal' | 'dificil' | 'chefe' | null;
  botPersonality?: 'agressivo' | 'defensivo' | 'blefador' | 'equilibrado' | null;
  characterId: string;
  maxHp: number;
  currentHp: number;
  maxEnergy: number;
  currentEnergy: number;
  popularity: number; // Ibope 0-100%
  rage: number; // Tensão 0-100%
  activeStatuses: ActiveStatusEffect[];
  selectedCardId?: string | null;
  cardLocked: boolean;
  comboStreak: string[];
  cardCooldowns: Record<string, number>;
  hand: string[];
  allyUsed: boolean;
  passiveTriggered: boolean;
}

export class RpgBattleParticipant extends Model<RpgBattleParticipantAttributes, Partial<RpgBattleParticipantAttributes>> implements RpgBattleParticipantAttributes {
  public id!: string;
  public battleId!: string;
  public playerId!: string | null;
  public phone!: string | null;
  public name!: string;
  public isBot!: boolean;
  public botDifficulty!: 'facil' | 'normal' | 'dificil' | 'chefe' | null;
  public botPersonality!: 'agressivo' | 'defensivo' | 'blefador' | 'equilibrado' | null;
  public characterId!: string;
  public maxHp!: number;
  public currentHp!: number;
  public maxEnergy!: number;
  public currentEnergy!: number;
  public popularity!: number;
  public rage!: number;
  public activeStatuses!: ActiveStatusEffect[];
  public selectedCardId!: string | null;
  public cardLocked!: boolean;
  public comboStreak!: string[];
  public cardCooldowns!: Record<string, number>;
  public hand!: string[];
  public allyUsed!: boolean;
  public passiveTriggered!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RpgBattleParticipant.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    battleId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    playerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Lutador',
    },
    isBot: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    botDifficulty: {
      type: DataTypes.ENUM('facil', 'normal', 'dificil', 'chefe'),
      allowNull: true,
    },
    botPersonality: {
      type: DataTypes.ENUM('agressivo', 'defensivo', 'blefador', 'equilibrado'),
      allowNull: true,
    },
    characterId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    maxHp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    currentHp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    maxEnergy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
    },
    currentEnergy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4,
    },
    popularity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    rage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    activeStatuses: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    selectedCardId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cardLocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    comboStreak: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    cardCooldowns: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    hand: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    allyUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    passiveTriggered: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'rpg_battle_participants',
    timestamps: true,
    indexes: [
      { fields: ['battleId'] },
      { fields: ['playerId'] },
      { fields: ['phone'] },
    ],
  }
);
