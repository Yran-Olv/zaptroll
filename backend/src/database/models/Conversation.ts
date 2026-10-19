import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export interface ConversationAttributes {
  id: string;
  connectionId: string;
  jid: string;
  chatType: 'direct' | 'group' | 'newsletter';
  name: string | null;
  phoneNumber?: string | null;
  unreadCount: number;
  lastMessageText: string | null;
  lastMessageTimestamp: Date | null;
  profilePicUrl?: string | null;
  status: 'open' | 'closed';
  createdAt?: Date;
  updatedAt?: Date;
}

export type ConversationCreationAttributes = Optional<
  ConversationAttributes,
  'id' | 'chatType' | 'name' | 'phoneNumber' | 'unreadCount' | 'lastMessageText' | 'lastMessageTimestamp' | 'profilePicUrl' | 'status'
>;

export class Conversation
  extends Model<ConversationAttributes, ConversationCreationAttributes>
  implements ConversationAttributes
{
  declare id: string;
  declare connectionId: string;
  declare jid: string;
  declare chatType: 'direct' | 'group' | 'newsletter';
  declare name: string | null;
  declare phoneNumber?: string | null;
  declare unreadCount: number;
  declare lastMessageText: string | null;
  declare lastMessageTimestamp: Date | null;
  declare profilePicUrl?: string | null;
  declare status: 'open' | 'closed';
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Conversation.init(
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
    jid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    chatType: {
      type: DataTypes.ENUM('direct', 'group', 'newsletter'),
      defaultValue: 'direct',
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    unreadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    lastMessageText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastMessageTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    profilePicUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'open',
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'conversations',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['connectionId', 'jid'],
      },
    ],
  }
);
