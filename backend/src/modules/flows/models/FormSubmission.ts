import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type FormSubmissionStatus = 'pending' | 'submitted' | 'processed';

export interface FormSubmissionAttributes {
  id: string;
  formId: string;
  publicId: string;
  flowSessionId?: string | null;
  userJid?: string | null;
  connectionId?: string | null;
  schemaSnapshot: Record<string, any>;
  data: Record<string, any>;
  status: FormSubmissionStatus;
  expiresAt: Date;
  submittedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FormSubmissionCreationAttributes
  extends Optional<FormSubmissionAttributes, 'id' | 'flowSessionId' | 'userJid' | 'connectionId' | 'data' | 'status' | 'submittedAt'> {}

export class FormSubmission
  extends Model<FormSubmissionAttributes, FormSubmissionCreationAttributes>
  implements FormSubmissionAttributes
{
  declare id: string;
  declare formId: string;
  declare publicId: string;
  declare flowSessionId?: string | null;
  declare userJid?: string | null;
  declare connectionId?: string | null;
  declare schemaSnapshot: Record<string, any>;
  declare data: Record<string, any>;
  declare status: FormSubmissionStatus;
  declare expiresAt: Date;
  declare submittedAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

FormSubmission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    formId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    publicId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    flowSessionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    userJid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    connectionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    schemaSnapshot: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false,
    },
    data: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'submitted', 'processed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'form_submissions',
    timestamps: true,
    indexes: [
      { fields: ['publicId'], unique: true },
      { fields: ['flowSessionId'] },
      { fields: ['status'] },
    ],
  }
);
