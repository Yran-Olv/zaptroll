import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export interface RpgAuditLogAttributes {
  id: string;
  adminId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: any;
}

export class RpgAuditLog extends Model<RpgAuditLogAttributes, Partial<RpgAuditLogAttributes>> implements RpgAuditLogAttributes {
  declare id: string;
  declare adminId: string | null;
  declare action: string;
  declare targetType: string;
  declare targetId: string | null;
  declare details: any;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RpgAuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    targetType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    targetId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rpg_audit_logs',
    timestamps: true,
  }
);
