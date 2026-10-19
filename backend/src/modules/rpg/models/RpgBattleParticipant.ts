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
  declare id: string;
  declare battleId: string;
  declare playerId: string | null;
  declare phone: string | null;
  declare name: string;
  declare isBot: boolean;
  declare botDifficulty: 'facil' | 'normal' | 'dificil' | 'chefe' | null;
  declare botPersonality: 'agressivo' | 'defensivo' | 'blefador' | 'equilibrado' | null;
  declare characterId: string;
  declare maxHp: number;
  declare currentHp: number;
  declare maxEnergy: number;
  declare currentEnergy: number;
  declare popularity: number;
  declare rage: number;
  declare activeStatuses: ActiveStatusEffect[];
  declare selectedCardId: string | null;
  declare cardLocked: boolean;
  declare comboStreak: string[];
  declare cardCooldowns: Record<string, number>;
  declare hand: string[];
  declare allyUsed: boolean;
  declare passiveTriggered: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
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
