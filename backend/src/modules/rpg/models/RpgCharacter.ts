import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type CharacterClass = 'demagogo' | 'tecnocrata' | 'populista' | 'estrategista' | 'militante';
export type CharacterElement = 'retorica' | 'burocracia' | 'midia' | 'economia' | 'juridico' | 'povao';
export type CharacterRarity = 'comum' | 'rara' | 'epica' | 'lendaria';

export interface CharacterQuotes {
  intro: string[];
  victory: string[];
  defeat: string[];
  taunt: string[];
}

export interface CharacterPassive {
  type: 'revive_once' | 'rage_bonus' | 'energy_shield' | 'combo_master' | 'free_ally' | 'critical_surge';
  value: number;
  description: string;
}

export interface RpgCharacterAttributes {
  id: string;
  name: string;
  title: string;
  description: string;
  characterClass: CharacterClass;
  affinity: CharacterElement;
  weakness: CharacterElement;
  resistance: CharacterElement;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpeed: number;
  baseCrit: number;
  baseCharisma: number;
  passiveName: string;
  passiveDescription: string;
  passiveEffect: CharacterPassive;
  quotes: CharacterQuotes;
  rarity: CharacterRarity;
  active: boolean; // Kill-switch legal/plataforma
  avatarEmoji: string;
}

export class RpgCharacter extends Model<RpgCharacterAttributes, Partial<RpgCharacterAttributes>> implements RpgCharacterAttributes {
  public id!: string;
  public name!: string;
  public title!: string;
  public description!: string;
  public characterClass!: CharacterClass;
  public affinity!: CharacterElement;
  public weakness!: CharacterElement;
  public resistance!: CharacterElement;
  public baseHp!: number;
  public baseAtk!: number;
  public baseDef!: number;
  public baseSpeed!: number;
  public baseCrit!: number;
  public baseCharisma!: number;
  public passiveName!: string;
  public passiveDescription!: string;
  public passiveEffect!: CharacterPassive;
  public quotes!: CharacterQuotes;
  public rarity!: CharacterRarity;
  public active!: boolean;
  public avatarEmoji!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RpgCharacter.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    characterClass: {
      type: DataTypes.ENUM('demagogo', 'tecnocrata', 'populista', 'estrategista', 'militante'),
      allowNull: false,
      defaultValue: 'demagogo',
    },
    affinity: {
      type: DataTypes.ENUM('retorica', 'burocracia', 'midia', 'economia', 'juridico', 'povao'),
      allowNull: false,
      defaultValue: 'retorica',
    },
    weakness: {
      type: DataTypes.ENUM('retorica', 'burocracia', 'midia', 'economia', 'juridico', 'povao'),
      allowNull: false,
      defaultValue: 'povao',
    },
    resistance: {
      type: DataTypes.ENUM('retorica', 'burocracia', 'midia', 'economia', 'juridico', 'povao'),
      allowNull: false,
      defaultValue: 'juridico',
    },
    baseHp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    baseAtk: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
    },
    baseDef: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
    },
    baseSpeed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
    },
    baseCrit: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.05,
    },
    baseCharisma: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
    },
    passiveName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    passiveDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    passiveEffect: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    quotes: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    rarity: {
      type: DataTypes.ENUM('comum', 'rara', 'epica', 'lendaria'),
      allowNull: false,
      defaultValue: 'comum',
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    avatarEmoji: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '👔',
    },
  },
  {
    sequelize,
    tableName: 'rpg_characters',
    timestamps: true,
  }
);
