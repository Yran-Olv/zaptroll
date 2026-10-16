import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export interface MessageAttributes {
  id: string;
  connectionId: string;
  conversationId: string;
  stanzaId: string;
  senderJid: string;
  fromMe: boolean;
  messageType: string;
  content: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaMimetype?: string | null;
  mediaFilename?: string | null;
  thumbnailUrl?: string | null;
  isProtocol?: boolean;
  rawPayload: any;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'revoked';
  timestamp: Date;
  isRevoked: boolean;
  participant?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MessageCreationAttributes = Optional<
  MessageAttributes,
  | 'id'
  | 'content'
  | 'caption'
  | 'mediaUrl'
  | 'mediaMimetype'
  | 'mediaFilename'
  | 'thumbnailUrl'
  | 'isProtocol'
  | 'rawPayload'
  | 'status'
  | 'isRevoked'
  | 'participant'
>;

export class Message
  extends Model<MessageAttributes, MessageCreationAttributes>
  implements MessageAttributes
{
  declare id: string;
  declare connectionId: string;
  declare conversationId: string;
  declare stanzaId: string;
  declare senderJid: string;
  declare fromMe: boolean;
  declare messageType: string;
  declare content: string | null;
  declare caption?: string | null;
  declare mediaUrl?: string | null;
  declare mediaMimetype?: string | null;
  declare mediaFilename?: string | null;
  declare thumbnailUrl?: string | null;
  declare isProtocol?: boolean;
  declare rawPayload: any;
  declare status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'revoked';
  declare timestamp: Date;
  declare isRevoked: boolean;
  declare participant?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    connectionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'whatsapp_connections',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'conversations',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    stanzaId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    senderJid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fromMe: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    messageType: {
      type: DataTypes.STRING,
      defaultValue: 'text',
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    caption: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    mediaUrl: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    mediaMimetype: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mediaFilename: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    thumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isProtocol: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    rawPayload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'revoked'),
      defaultValue: 'sent',
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    participant: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'messages',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['connectionId', 'stanzaId'],
      },
      {
        fields: ['conversationId'],
      },
      {
        fields: ['timestamp'],
      },
    ],
  }
);
