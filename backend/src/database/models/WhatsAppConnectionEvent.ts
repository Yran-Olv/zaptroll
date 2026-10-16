import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export interface WhatsAppConnectionEventAttributes {
  id: string;
  connectionId: string;
  eventType: string;
  payload: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export type WhatsAppConnectionEventCreationAttributes = Optional<WhatsAppConnectionEventAttributes, 'id'>;

export class WhatsAppConnectionEvent
  extends Model<WhatsAppConnectionEventAttributes, WhatsAppConnectionEventCreationAttributes>
  implements WhatsAppConnectionEventAttributes
{
  declare id: string;
  declare connectionId: string;
  declare eventType: string;
  declare payload: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

WhatsAppConnectionEvent.init(
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
    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'whatsapp_connection_events',
    timestamps: true,
  }
);
