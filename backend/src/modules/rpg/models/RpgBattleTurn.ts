import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export interface TurnEvent {
  type: string; // 'card_reveal' | 'damage' | 'status_applied' | 'block' | 'dodge' | 'combo' | 'ko' | 'ally_summon' | 'passive'
  actor: 'p1' | 'p2';
  target?: 'p1' | 'p2';
  value?: number;
  message: string;
  metadata?: any;
}

export interface RpgBattleTurnAttributes {
  id: string;
  battleId: string;
  turnNumber: number;
  p1Choice?: string | null;
  p2Choice?: string | null;
  p1HpAfter: number;
  p2HpAfter: number;
  p1EnergyAfter: number;
  p2EnergyAfter: number;
  logSummary: string;
  events: TurnEvent[];
  rngSeedUsed: number;
}

export class RpgBattleTurn extends Model<RpgBattleTurnAttributes, Partial<RpgBattleTurnAttributes>> implements RpgBattleTurnAttributes {
  declare id: string;
  declare battleId: string;
  declare turnNumber: number;
  declare p1Choice: string | null;
  declare p2Choice: string | null;
  declare p1HpAfter: number;
  declare p2HpAfter: number;
  declare p1EnergyAfter: number;
  declare p2EnergyAfter: number;
  declare logSummary: string;
  declare events: TurnEvent[];
  declare rngSeedUsed: number;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RpgBattleTurn.init(
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
    turnNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    p1Choice: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    p2Choice: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    p1HpAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    p2HpAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    p1EnergyAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    p2EnergyAfter: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    logSummary: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    events: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    rngSeedUsed: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'rpg_battle_turns',
    timestamps: true,
    indexes: [
      { fields: ['battleId', 'turnNumber'] },
    ],
  }
);
