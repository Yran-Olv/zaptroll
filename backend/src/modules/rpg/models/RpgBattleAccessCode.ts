import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type AccessRole = 'fighter' | 'spectator';

export interface RpgBattleAccessCodeAttributes {
  id: string;
  code: string;
  battleId: string;
  playerId?: string | null;
  participantId?: string | null;
  phone?: string | null;
  role: AccessRole;
  expiresAt: Date;
  revoked: boolean;
  lastUsedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class RpgBattleAccessCode
  extends Model<RpgBattleAccessCodeAttributes, Partial<RpgBattleAccessCodeAttributes>>
  implements RpgBattleAccessCodeAttributes {
  declare id: string;
  declare code: string;
  declare battleId: string;
  declare playerId: string | null;
  declare participantId: string | null;
  declare phone: string | null;
  declare role: AccessRole;
  declare expiresAt: Date;
  declare revoked: boolean;
  declare lastUsedAt: Date | null;
  declare ipAddress: string | null;
  declare userAgent: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RpgBattleAccessCode.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    battleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'rpg_battles',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    playerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    participantId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'spectator',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rpg_battle_access_codes',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['code'],
      },
      {
        fields: ['battleId'],
      },
      {
        fields: ['participantId'],
      },
      {
        fields: ['expiresAt'],
      },
    ],
  }
);
