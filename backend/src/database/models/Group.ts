import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export interface GroupAttributes {
  id: string;
  connectionId: string;
  jid: string;
  name: string;
  description: string | null;
  participantCount: number;
  metadata: any;
  lastSyncAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type GroupCreationAttributes = Optional<
  GroupAttributes,
  'id' | 'description' | 'participantCount' | 'metadata' | 'lastSyncAt'
>;

export class Group
  extends Model<GroupAttributes, GroupCreationAttributes>
  implements GroupAttributes
{
  declare id: string;
  declare connectionId: string;
  declare jid: string;
  declare name: string;
  declare description: string | null;
  declare participantCount: number;
  declare metadata: any;
  declare lastSyncAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Group.init(
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    participantCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
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
    tableName: 'groups',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['connectionId', 'jid'],
      },
    ],
  }
);
