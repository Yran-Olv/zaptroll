import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type FlowSessionStatus = 'active' | 'waiting_input' | 'completed' | 'cancelled' | 'error';

export interface FlowSessionAttributes {
  id: string;
  flowId: string;
  flowVersionId: string;
  connectionId: string;
  userJid: string;
  currentNodeId: string;
  waitingFor?: string | null;
  status: FlowSessionStatus;
  variables: Record<string, any>;
  stepHistory: Array<{
    nodeId: string;
    timestamp: string;
    action?: string;
  }>;
  lastInteractionAt: Date;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FlowSessionCreationAttributes
  extends Optional<FlowSessionAttributes, 'id' | 'waitingFor' | 'status' | 'variables' | 'stepHistory'> {}

export class FlowSession
  extends Model<FlowSessionAttributes, FlowSessionCreationAttributes>
  implements FlowSessionAttributes
{
  declare id: string;
  declare flowId: string;
  declare flowVersionId: string;
  declare connectionId: string;
  declare userJid: string;
  declare currentNodeId: string;
  declare waitingFor?: string | null;
  declare status: FlowSessionStatus;
  declare variables: Record<string, any>;
  declare stepHistory: Array<{
    nodeId: string;
    timestamp: string;
    action?: string;
  }>;
  declare lastInteractionAt: Date;
  declare expiresAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

FlowSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    flowId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    flowVersionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    connectionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userJid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    currentNodeId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    waitingFor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'waiting_input', 'completed', 'cancelled', 'error'),
      defaultValue: 'active',
      allowNull: false,
    },
    variables: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false,
    },
    stepHistory: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false,
    },
    lastInteractionAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'flow_sessions',
    timestamps: true,
    indexes: [
      { fields: ['connectionId', 'userJid', 'status'] },
      { fields: ['flowId', 'status'] },
      { fields: ['expiresAt'] },
    ],
  }
);
