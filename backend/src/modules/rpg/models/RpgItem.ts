import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type ItemType = 'arma' | 'roupa' | 'acessorio' | 'amuleto' | 'consumivel';
export type ItemRarity = 'comum' | 'rara' | 'epica' | 'lendaria';

export interface RpgItemAttributes {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  price: number;
  bonusHp: number;
  bonusAtk: number;
  bonusDef: number;
  emoji: string;
  consumableEffect?: any;
}

export class RpgItem extends Model<RpgItemAttributes, Partial<RpgItemAttributes>> implements RpgItemAttributes {
  declare id: string;
  declare name: string;
  declare description: string;
  declare type: ItemType;
  declare rarity: ItemRarity;
  declare price: number;
  declare bonusHp: number;
  declare bonusAtk: number;
  declare bonusDef: number;
  declare emoji: string;
  declare consumableEffect: any;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RpgItem.init(
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
    type: {
      type: DataTypes.ENUM('arma', 'roupa', 'acessorio', 'amuleto', 'consumivel'),
      allowNull: false,
    },
    rarity: {
      type: DataTypes.ENUM('comum', 'rara', 'epica', 'lendaria'),
      allowNull: false,
      defaultValue: 'comum',
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
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
    emoji: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '📦',
    },
    consumableEffect: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rpg_items',
    timestamps: true,
  }
);

export interface RpgInventoryAttributes {
  id: string;
  playerId: string;
  itemId: string;
  equipped: boolean;
  quantity: number;
}

export class RpgInventory extends Model<RpgInventoryAttributes, Partial<RpgInventoryAttributes>> implements RpgInventoryAttributes {
  declare id: string;
  declare playerId: string;
  declare itemId: string;
  declare equipped: boolean;
  declare quantity: number;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RpgInventory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    playerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    itemId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    equipped: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'rpg_inventory',
    timestamps: true,
    indexes: [
      { fields: ['playerId', 'itemId'] },
    ],
  }
);
