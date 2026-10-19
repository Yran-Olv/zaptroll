import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export interface RpgPlayerAttributes {
  id: string;
  whatsappPhone: string;
  name: string;
  level: number;
  xp: number;
  coins: number;
  eventTokens: number;
  victories: number;
  defeats: number;
  draws: number;
  winStreak: number;
  elo: number;
  prestige: number;
  selectedCharacterId: string;
  equippedTitle: string;
  lastDailyRewardAt?: Date | null;
  dailyStreak: number;
  statPoints: number;
  bonusHp: number;
  bonusAtk: number;
  bonusDef: number;
  reputation: number; // -100 (Esperto/Sombrio) a +100 (Honesto/Puro)
}

export class RpgPlayer extends Model<RpgPlayerAttributes, Partial<RpgPlayerAttributes>> implements RpgPlayerAttributes {
  declare id: string;
  declare whatsappPhone: string;
  declare name: string;
  declare level: number;
  declare xp: number;
  declare coins: number;
  declare eventTokens: number;
  declare victories: number;
  declare defeats: number;
  declare draws: number;
  declare winStreak: number;
  declare elo: number;
  declare prestige: number;
  declare selectedCharacterId: string;
  declare equippedTitle: string;
  declare lastDailyRewardAt: Date | null;
  declare dailyStreak: number;
  declare statPoints: number;
  declare bonusHp: number;
  declare bonusAtk: number;
  declare bonusDef: number;
  declare reputation: number;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  /**
   * Fórmula oficial de XP para o próximo nível: base * nivel^1.5
   */
  public static getXpForNextLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
  }
}

RpgPlayer.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    whatsappPhone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Candidato',
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    xp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    coins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 500, // Saldo inicial de campanha
    },
    eventTokens: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    victories: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    defeats: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    draws: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    winStreak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    elo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
    },
    prestige: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    selectedCharacterId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'doutor_promessa',
    },
    equippedTitle: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Candidato Independente',
    },
    lastDailyRewardAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    dailyStreak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    statPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bonusHp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bonusAtk: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bonusDef: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    reputation: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'rpg_players',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['whatsappPhone'] },
      { fields: ['elo'] },
    ],
  }
);
