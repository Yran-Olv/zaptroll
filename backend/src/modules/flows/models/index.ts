import { Flow } from './Flow.js';
import { FlowVersion } from './FlowVersion.js';
import { FlowSession } from './FlowSession.js';
import { FlowExecutionEvent } from './FlowExecutionEvent.js';
import { FormSubmission } from './FormSubmission.js';
import { User, WhatsAppConnection } from '../../../database/models/index.js';

// Associations
Flow.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Flow, { foreignKey: 'userId', as: 'flows', onDelete: 'CASCADE' });

Flow.hasMany(FlowVersion, { foreignKey: 'flowId', as: 'versions', onDelete: 'CASCADE' });
FlowVersion.belongsTo(Flow, { foreignKey: 'flowId', as: 'flow' });

Flow.hasMany(FlowSession, { foreignKey: 'flowId', as: 'sessions', onDelete: 'CASCADE' });
FlowSession.belongsTo(Flow, { foreignKey: 'flowId', as: 'flow' });

FlowSession.hasMany(FlowExecutionEvent, { foreignKey: 'flowSessionId', as: 'events', onDelete: 'CASCADE' });
FlowExecutionEvent.belongsTo(FlowSession, { foreignKey: 'flowSessionId', as: 'session' });

export {
  Flow,
  FlowVersion,
  FlowSession,
  FlowExecutionEvent,
  FormSubmission,
};
