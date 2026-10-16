import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../index.js';

export interface UserAttributes {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  maxConnections: number;
  rateLimit: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<UserAttributes, 'id' | 'role' | 'status' | 'maxConnections' | 'rateLimit'>;

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare role: 'admin' | 'user';
  declare status: 'active' | 'suspended';
  declare maxConnections: number;
  declare rateLimit: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      defaultValue: 'user',
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended'),
      defaultValue: 'active',
      allowNull: false,
    },
    maxConnections: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      allowNull: false,
    },
    rateLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 120,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
  }
);
