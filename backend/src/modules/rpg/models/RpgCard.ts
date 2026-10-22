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
  image?: string | null;
}

export class RpgCard extends Model<RpgCardAttributes, Partial<RpgCardAttributes>> implements RpgCardAttributes {
  declare id: string;
  declare name: string;
  declare description: string;
  declare category: CardCategory;
  declare element: CardElement;
  declare energyCost: number;
  declare power: number;
  declare priority: number;
  declare cooldown: number;
  declare rarity: CardRarity;
  declare targetEffect: CardEffect | null;
  declare selfEffect: CardEffect | null;
  declare isBluff: boolean;
  declare isComboStarter: boolean;
  declare comboFollowUp: string | null;
  declare emoji: string;
  declare image: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
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
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rpg_cards',
    timestamps: true,
  }
);
