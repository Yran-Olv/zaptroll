import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export type FlowEventType =
  | 'session_start'
  | 'node_enter'
  | 'node_execute'
  | 'message_sent'
  | 'input_received'
  | 'http_request'
  | 'http_response'
  | 'variable_set'
  | 'condition_eval'
  | 'flow_end'
  | 'error';

export interface FlowExecutionEventAttributes {
  id: string;
  flowSessionId: string;
  flowId: string;
  nodeId?: string | null;
  eventType: FlowEventType;
  details: Record<string, any>;
  createdAt?: Date;
}

export interface FlowExecutionEventCreationAttributes
  extends Optional<FlowExecutionEventAttributes, 'id' | 'nodeId' | 'details'> {}

export class FlowExecutionEvent
  extends Model<FlowExecutionEventAttributes, FlowExecutionEventCreationAttributes>
  implements FlowExecutionEventAttributes
{
  declare id: string;
  declare flowSessionId: string;
  declare flowId: string;
  declare nodeId?: string | null;
  declare eventType: FlowEventType;
  declare details: Record<string, any>;
  declare readonly createdAt: Date;
}

FlowExecutionEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    flowSessionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    flowId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    nodeId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    eventType: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    details: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'flow_execution_events',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['flowSessionId'] },
      { fields: ['flowId'] },
      { fields: ['createdAt'] },
    ],
  }
);
