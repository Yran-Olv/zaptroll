import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export interface ContactAttributes {
  id: string;
  connectionId: string;
  jid: string;
  phoneNumber: string | null;
  name: string | null;
  notifyName: string | null;
  profilePicUrl: string | null;
  lastSyncAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ContactCreationAttributes = Optional<
  ContactAttributes,
  'id' | 'phoneNumber' | 'name' | 'notifyName' | 'profilePicUrl' | 'lastSyncAt'
>;

export class Contact
  extends Model<ContactAttributes, ContactCreationAttributes>
  implements ContactAttributes
{
  declare id: string;
  declare connectionId: string;
  declare jid: string;
  declare phoneNumber: string | null;
  declare name: string | null;
  declare notifyName: string | null;
  declare profilePicUrl: string | null;
  declare lastSyncAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Contact.init(
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
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notifyName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profilePicUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'contacts',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['connectionId', 'jid'],
      },
    ],
  }
);
