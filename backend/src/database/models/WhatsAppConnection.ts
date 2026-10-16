import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export interface WhatsAppConnectionAttributes {
  id: string;
  userId: string;
  name: string;
  sessionId: string;
  status: 'disconnected' | 'connecting' | 'awaiting_auth' | 'connected' | 'error';
  phoneNumber: string | null;
  qrCode: string | null;
  pairingCode: string | null;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  lastError: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type WhatsAppConnectionCreationAttributes = Optional<
  WhatsAppConnectionAttributes,
  'id' | 'status' | 'phoneNumber' | 'qrCode' | 'pairingCode' | 'lastConnectedAt' | 'lastDisconnectedAt' | 'lastError'
>;

export class WhatsAppConnection
  extends Model<WhatsAppConnectionAttributes, WhatsAppConnectionCreationAttributes>
  implements WhatsAppConnectionAttributes
{
  declare id: string;
  declare userId: string;
  declare name: string;
  declare sessionId: string;
  declare status: 'disconnected' | 'connecting' | 'awaiting_auth' | 'connected' | 'error';
  declare phoneNumber: string | null;
  declare qrCode: string | null;
  declare pairingCode: string | null;
  declare lastConnectedAt: Date | null;
  declare lastDisconnectedAt: Date | null;
  declare lastError: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

WhatsAppConnection.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('disconnected', 'connecting', 'awaiting_auth', 'connected', 'error'),
      defaultValue: 'disconnected',
      allowNull: false,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    qrCode: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pairingCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastConnectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastDisconnectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'whatsapp_connections',
    timestamps: true,
  }
);
