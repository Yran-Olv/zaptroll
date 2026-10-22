import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export type AutoDestructTaskStatus =
  | 'scheduled'
  | 'processing'
  | 'request_sent'
  | 'confirmed'
  | 'retrying'
  | 'failed'
  | 'cancelled';

export interface AutoDestructTaskAttributes {
  id: string;
  connectionId: string;
  conversationId?: string;
  stanzaId: string;
  targetJid: string;
  status: AutoDestructTaskStatus;
  delaySeconds: number;
  executeAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
  requestSentAt?: Date | null;
  confirmedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AutoDestructTaskCreationAttributes
  extends Optional<AutoDestructTaskAttributes, 'id' | 'status' | 'attempts' | 'maxAttempts' | 'lastError' | 'requestSentAt' | 'confirmedAt'> {}

export class AutoDestructTask
  extends Model<AutoDestructTaskAttributes, AutoDestructTaskCreationAttributes>
  implements AutoDestructTaskAttributes
{
  declare id: string;
  declare connectionId: string;
  declare conversationId?: string;
  declare stanzaId: string;
  declare targetJid: string;
  declare status: AutoDestructTaskStatus;
  declare delaySeconds: number;
  declare executeAt: Date;
  declare attempts: number;
  declare maxAttempts: number;
  declare lastError?: string | null;
  declare requestSentAt?: Date | null;
  declare confirmedAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AutoDestructTask.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    connectionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    stanzaId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    targetJid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'processing', 'request_sent', 'confirmed', 'retrying', 'failed', 'cancelled'),
      defaultValue: 'scheduled',
      allowNull: false,
    },
    delaySeconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    executeAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    maxAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      allowNull: false,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    requestSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'auto_destruct_tasks',
    timestamps: true,
    indexes: [
      {
        fields: ['status', 'executeAt'],
      },
      {
        fields: ['connectionId', 'stanzaId'],
      },
    ],
  }
);
