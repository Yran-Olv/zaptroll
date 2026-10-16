import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import connectionsRoutes from '../modules/connections/connections.routes.js';
import conversationsRoutes from '../modules/conversations/conversations.routes.js';
import messagesRoutes from '../modules/messages/messages.routes.js';
import contactsRoutes from '../modules/contacts/contacts.routes.js';
import groupsRoutes from '../modules/groups/groups.routes.js';
import advancedRoutes from '../modules/advanced/advanced.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import memesRoutes from '../modules/memes/memes.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/connections', connectionsRoutes);
apiRouter.use('/conversations', conversationsRoutes);
apiRouter.use('/messages', messagesRoutes);
apiRouter.use('/contacts', contactsRoutes);
apiRouter.use('/groups', groupsRoutes);
apiRouter.use('/advanced', advancedRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/memes', memesRoutes);

export default apiRouter;
