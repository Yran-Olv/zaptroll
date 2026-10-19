import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type BattleMode = 'pvp' | 'pve' | 'campaign';
export type BattleStatus =
  | 'selecting_characters'
  | 'selecting_cards'
  | 'resolving_turn'
  | 'finished'
  | 'abandoned'
  | 'cancelled';

export interface RpgBattleAttributes {
  id: string;
  connectionId: string;
  groupId?: string | null;
  mode: BattleMode;
  status: BattleStatus;
  arena: string;
  currentTurn: number;
  maxTurns: number;
  turnDeadline?: Date | null;
  winnerPlayerId?: string | null;
  rngSeed: number;
  version: number;
  lastMessageId?: string | null;
  lastMessageTimestamp?: Date | null;
  modifier?: string | null;
}

export class RpgBattle extends Model<RpgBattleAttributes, Partial<RpgBattleAttributes>> implements RpgBattleAttributes {
  public id!: string;
  public connectionId!: string;
  public groupId!: string | null;
  public mode!: BattleMode;
  public status!: BattleStatus;
  public arena!: string;
  public currentTurn!: number;
  public maxTurns!: number;
  public turnDeadline!: Date | null;
  public winnerPlayerId!: string | null;
  public rngSeed!: number;
  public version!: number;
  public lastMessageId!: string | null;
  public lastMessageTimestamp!: Date | null;
  public modifier!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RpgBattle.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    connectionId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    groupId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mode: {
      type: DataTypes.ENUM('pvp', 'pve', 'campaign'),
      allowNull: false,
      defaultValue: 'pvp',
    },
    status: {
      type: DataTypes.ENUM(
        'selecting_characters',
        'selecting_cards',
        'resolving_turn',
        'finished',
        'abandoned',
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'selecting_cards',
    },
    arena: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ring_brasilia',
    },
    currentTurn: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    maxTurns: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20,
    },
    turnDeadline: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    winnerPlayerId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rngSeed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Math.floor(Math.random() * 1000000),
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    lastMessageId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastMessageTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    modifier: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rpg_battles',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['connectionId'] },
      { fields: ['groupId'] },
    ],
  }
);
