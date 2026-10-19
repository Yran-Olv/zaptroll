import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export interface RpgPlayerCardAttributes {
  id: string;
  playerId: string;
  cardId: string;
  level: number;
  fragments: number;
  inDeck: boolean;
}

export class RpgPlayerCard extends Model<RpgPlayerCardAttributes, Partial<RpgPlayerCardAttributes>> implements RpgPlayerCardAttributes {
  public id!: string;
  public playerId!: string;
  public cardId!: string;
  public level!: number;
  public fragments!: number;
  public inDeck!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RpgPlayerCard.init(
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
    cardId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    fragments: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    inDeck: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'rpg_player_cards',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['playerId', 'cardId'] },
    ],
  }
);

export interface RpgPlayerCharacterAttributes {
  id: string;
  playerId: string;
  characterId: string;
  level: number;
  masteryXp: number;
}

export class RpgPlayerCharacter extends Model<RpgPlayerCharacterAttributes, Partial<RpgPlayerCharacterAttributes>> implements RpgPlayerCharacterAttributes {
  public id!: string;
  public playerId!: string;
  public characterId!: string;
  public level!: number;
  public masteryXp!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RpgPlayerCharacter.init(
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
    characterId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    masteryXp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'rpg_player_characters',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['playerId', 'characterId'] },
    ],
  }
);
