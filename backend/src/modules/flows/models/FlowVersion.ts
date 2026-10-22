import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export interface FlowNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  label?: string;
}

export interface FlowVariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  defaultValue?: any;
}

export interface FlowVersionAttributes {
  id: string;
  flowId: string;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariableDefinition[];
  isPublished: boolean;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FlowVersionCreationAttributes
  extends Optional<FlowVersionAttributes, 'id' | 'isPublished' | 'publishedAt'> {}

export class FlowVersion
  extends Model<FlowVersionAttributes, FlowVersionCreationAttributes>
  implements FlowVersionAttributes
{
  declare id: string;
  declare flowId: string;
  declare version: number;
  declare nodes: FlowNode[];
  declare edges: FlowEdge[];
  declare variables: FlowVariableDefinition[];
  declare isPublished: boolean;
  declare publishedAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

FlowVersion.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    flowId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    nodes: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false,
    },
    edges: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false,
    },
    variables: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'flow_versions',
    timestamps: true,
    indexes: [
      { fields: ['flowId', 'version'], unique: true },
      { fields: ['flowId', 'isPublished'] },
    ],
  }
);
