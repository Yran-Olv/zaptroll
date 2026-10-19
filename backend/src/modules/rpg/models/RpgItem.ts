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
  public id!: string;
  public name!: string;
  public description!: string;
  public type!: ItemType;
  public rarity!: ItemRarity;
  public price!: number;
  public bonusHp!: number;
  public bonusAtk!: number;
  public bonusDef!: number;
  public emoji!: string;
  public consumableEffect!: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
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
  public id!: string;
  public playerId!: string;
  public itemId!: string;
  public equipped!: boolean;
  public quantity!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
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
