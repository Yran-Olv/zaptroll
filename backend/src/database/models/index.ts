import bcrypt from 'bcryptjs';
import { sequelize } from '../index.js';
import { User } from './User.js';
import { WhatsAppConnection } from './WhatsAppConnection.js';
import { WhatsAppConnectionEvent } from './WhatsAppConnectionEvent.js';
import { Contact } from './Contact.js';
import { Group } from './Group.js';
import { Conversation } from './Conversation.js';
import { Message } from './Message.js';
import { MessageTemplate } from './MessageTemplate.js';
import { AuditLog } from './AuditLog.js';
import { config } from '../../config/index.js';

// Define Associations
User.hasMany(WhatsAppConnection, { foreignKey: 'userId', as: 'connections', onDelete: 'CASCADE' });
WhatsAppConnection.belongsTo(User, { foreignKey: 'userId', as: 'user' });

WhatsAppConnection.hasMany(WhatsAppConnectionEvent, { foreignKey: 'connectionId', as: 'events', onDelete: 'CASCADE' });
WhatsAppConnectionEvent.belongsTo(WhatsAppConnection, { foreignKey: 'connectionId', as: 'connection' });

WhatsAppConnection.hasMany(Contact, { foreignKey: 'connectionId', as: 'contacts', onDelete: 'CASCADE' });
Contact.belongsTo(WhatsAppConnection, { foreignKey: 'connectionId', as: 'connection' });

WhatsAppConnection.hasMany(Group, { foreignKey: 'connectionId', as: 'groups', onDelete: 'CASCADE' });
Group.belongsTo(WhatsAppConnection, { foreignKey: 'connectionId', as: 'connection' });

WhatsAppConnection.hasMany(Conversation, { foreignKey: 'connectionId', as: 'conversations', onDelete: 'CASCADE' });
Conversation.belongsTo(WhatsAppConnection, { foreignKey: 'connectionId', as: 'connection' });

Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation' });

WhatsAppConnection.hasMany(Message, { foreignKey: 'connectionId', as: 'connectionMessages', onDelete: 'CASCADE' });
Message.belongsTo(WhatsAppConnection, { foreignKey: 'connectionId', as: 'connection' });

User.hasMany(MessageTemplate, { foreignKey: 'userId', as: 'templates', onDelete: 'CASCADE' });
MessageTemplate.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs', onDelete: 'SET NULL' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export async function initDatabase(force = false) {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    await sequelize.sync({ alter: !force, force });
    console.log('✅ Database models synchronized.');

    // Seed first administrator if none exists
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount === 0) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(config.firstAdmin.password, salt);
      await User.create({
        name: config.firstAdmin.name,
        email: config.firstAdmin.email,
        passwordHash,
        role: 'admin',
        status: 'active',
        maxConnections: 10,
        rateLimit: 1000,
      });
      console.log(`👑 First administrator provisioned: ${config.firstAdmin.email}`);
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

export {
  User,
  WhatsAppConnection,
  WhatsAppConnectionEvent,
  Contact,
  Group,
  Conversation,
  Message,
  MessageTemplate,
  AuditLog,
};
