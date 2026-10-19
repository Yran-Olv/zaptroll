import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type CardCategory = 'forca' | 'defesa' | 'estrategia' | 'utilidade';
export type CardElement = 'retorica' | 'burocracia' | 'midia' | 'economia' | 'juridico' | 'povao' | 'neutro';
export type CardRarity = 'comum' | 'rara' | 'epica' | 'lendaria';

export interface CardEffect {
  status?: string; // 'fake_news' | 'cpi' | 'cancelamento' | 'escanadalo' | 'blindagem' | 'furia'
  duration?: number;
  potency?: number;
  chance?: number;
  heal?: number;
  energyGain?: number;
  shield?: number;
  cleanse?: boolean;
}

export interface RpgCardAttributes {
  id: string;
  name: string;
  description: string;
  category: CardCategory;
  element: CardElement;
  energyCost: number;
  power: number;
  priority: number; // Maior resolve primeiro (ex: Esquiva=10, Soco=5, Especial=1)
  cooldown: number;
  rarity: CardRarity;
  targetEffect?: CardEffect | null;
  selfEffect?: CardEffect | null;
  isBluff?: boolean;
  isComboStarter?: boolean;
  comboFollowUp?: string | null;
  emoji: string;
}

export class RpgCard extends Model<RpgCardAttributes, Partial<RpgCardAttributes>> implements RpgCardAttributes {
  public id!: string;
  public name!: string;
  public description!: string;
  public category!: CardCategory;
  public element!: CardElement;
  public energyCost!: number;
  public power!: number;
  public priority!: number;
  public cooldown!: number;
  public rarity!: CardRarity;
  public targetEffect!: CardEffect | null;
  public selfEffect!: CardEffect | null;
  public isBluff!: boolean;
  public isComboStarter!: boolean;
  public comboFollowUp!: string | null;
  public emoji!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RpgCard.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('forca', 'defesa', 'estrategia', 'utilidade'),
      allowNull: false,
    },
    element: {
      type: DataTypes.ENUM('retorica', 'burocracia', 'midia', 'economia', 'juridico', 'povao', 'neutro'),
      allowNull: false,
      defaultValue: 'neutro',
    },
    energyCost: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    },
    power: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20,
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    cooldown: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    rarity: {
      type: DataTypes.ENUM('comum', 'rara', 'epica', 'lendaria'),
      allowNull: false,
      defaultValue: 'comum',
    },
    targetEffect: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    selfEffect: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    isBluff: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isComboStarter: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    comboFollowUp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emoji: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '🃏',
    },
  },
  {
    sequelize,
    tableName: 'rpg_cards',
    timestamps: true,
  }
);
