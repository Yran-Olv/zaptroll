import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface RpgDuelInviteAttributes {
  id: string;
  connectionId: string;
  groupId: string;
  challengerPhone: string;
  challengerName: string;
  challengedPhone: string;
  challengedName: string;
  status: InviteStatus;
  betAmount: number;
  expiresAt: Date;
  battleId?: string | null;
}

export class RpgDuelInvite extends Model<RpgDuelInviteAttributes, Partial<RpgDuelInviteAttributes>> implements RpgDuelInviteAttributes {
  declare id: string;
  declare connectionId: string;
  declare groupId: string;
  declare challengerPhone: string;
  declare challengerName: string;
  declare challengedPhone: string;
  declare challengedName: string;
  declare status: InviteStatus;
  declare betAmount: number;
  declare expiresAt: Date;
  declare battleId: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RpgDuelInvite.init(
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
      allowNull: false,
    },
    challengerPhone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    challengerName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Desafiante',
    },
    challengedPhone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    challengedName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adversário',
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
    },
    betAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    battleId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rpg_duel_invites',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['groupId'] },
      { fields: ['challengedPhone'] },
    ],
  }
);
