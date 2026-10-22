import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type FlowStatus = 'draft' | 'published' | 'archived';

export interface FlowAttributes {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: FlowStatus;
  currentVersion: number;
  publishedVersionId?: string | null;
  triggerKeywords: string[];
  connectionId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FlowCreationAttributes
  extends Optional<FlowAttributes, 'id' | 'status' | 'currentVersion' | 'publishedVersionId' | 'triggerKeywords' | 'connectionId'> {}

export class Flow extends Model<FlowAttributes, FlowCreationAttributes> implements FlowAttributes {
  declare id: string;
  declare userId: string;
  declare name: string;
  declare description?: string | null;
  declare status: FlowStatus;
  declare currentVersion: number;
  declare publishedVersionId?: string | null;
  declare triggerKeywords: string[];
  declare connectionId?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Flow.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'archived'),
      defaultValue: 'draft',
      allowNull: false,
    },
    currentVersion: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    publishedVersionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    triggerKeywords: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false,
    },
    connectionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'flows',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['status'] },
      { fields: ['connectionId'] },
    ],
  }
);
