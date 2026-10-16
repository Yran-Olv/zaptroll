import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export interface MessageTemplateAttributes {
  id: string;
  userId: string;
  name: string;
  category: 'buttons' | 'list' | 'carousel' | 'webview' | 'raw' | 'ephemeral';
  payload: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MessageTemplateCreationAttributes = Optional<MessageTemplateAttributes, 'id'>;

export class MessageTemplate
  extends Model<MessageTemplateAttributes, MessageTemplateCreationAttributes>
  implements MessageTemplateAttributes
{
  declare id: string;
  declare userId: string;
  declare name: string;
  declare category: 'buttons' | 'list' | 'carousel' | 'webview' | 'raw' | 'ephemeral';
  declare payload: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

MessageTemplate.init(
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
    category: {
      type: DataTypes.ENUM('buttons', 'list', 'carousel', 'webview', 'raw', 'ephemeral'),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'message_templates',
    timestamps: true,
  }
);
