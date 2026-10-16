import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../../middleware/auth.js';
import { Contact, WhatsAppConnection, Conversation, Group } from '../../database/models/index.js';
import { sequelize } from '../../database/index.js';
import { zapoManager } from '../../integrations/zapo/ZapoConnectionManager.js';

function formatPhoneNumber(phoneOrJid: string): string {
  if (!phoneOrJid) return '';
  const clean = phoneOrJid.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    const ddd = clean.slice(2, 4);
    const rest = clean.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    } else if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  if (clean.length >= 10) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
  }
  return phoneOrJid;
}

export class ContactsController {
  static async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const { search } = req.query;

      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      const whereClause: any = { connectionId };

      if (search && typeof search === 'string') {
        whereClause[Op.or] = [
          { name: { [Op.iLike || Op.like]: `%${search}%` } },
          { notifyName: { [Op.iLike || Op.like]: `%${search}%` } },
          { phoneNumber: { [Op.iLike || Op.like]: `%${search}%` } },
          { jid: { [Op.iLike || Op.like]: `%${search}%` } },
        ];
      }

      const contacts = await Contact.findAll({
        where: whereClause,
        order: [['name', 'ASC']],
      });

      res.json({ contacts });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtém os detalhes completos do perfil (Foto real em alta resolução, nome, telefone e recado/status)
   */
  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      let { connectionId, jid, conversationId } = req.query as {
        connectionId?: string;
        jid?: string;
        conversationId?: string;
      };

      if (!connectionId && conversationId) {
        const conv = await Conversation.findByPk(conversationId);
        if (conv) {
          connectionId = conv.connectionId;
          jid = conv.jid;
        }
      }

      if (!connectionId || !jid) {
        res.status(400).json({ error: 'connectionId e jid são obrigatórios.' });
        return;
      }

      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });

      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      // 1. Resolução do contato no banco (wa_mailbox_contacts, Contact, Conversation)
      let phoneJid: string | null = null;
      let lidJid: string | null = null;
      let contactName: string | null = null;
      let phoneNumber: string | null = null;

      try {
        const [rows]: any = await sequelize.query(
          `SELECT jid, lid, phone_number, display_name, push_name 
           FROM wa_mailbox_contacts 
           WHERE (jid = :jid OR lid = :jid OR phone_number = :jid) 
           LIMIT 1`,
          { replacements: { jid } }
        );
        if (rows && rows.length > 0) {
          const row = rows[0];
          phoneJid = row.phone_number || (row.jid?.endsWith('@s.whatsapp.net') ? row.jid : null);
          lidJid = row.lid || (row.jid?.endsWith('@lid') ? row.jid : null);
          contactName = row.display_name || row.push_name || null;
          if (phoneJid) {
            phoneNumber = formatPhoneNumber(phoneJid);
          }
        }
      } catch {}

      // Busca no modelo Contact
      const contactCandidates = [jid, phoneJid, lidJid].filter(Boolean) as string[];
      const contactRecord = await Contact.findOne({
        where: { connectionId, jid: { [Op.in]: contactCandidates } },
      });

      if (contactRecord) {
        if (!contactName) contactName = contactRecord.name || contactRecord.notifyName;
        if (!phoneNumber && contactRecord.phoneNumber) {
          phoneNumber = formatPhoneNumber(contactRecord.phoneNumber);
        }
      }

      // Busca no modelo Conversation
      const convRecord = await Conversation.findOne({
        where: { connectionId, jid: { [Op.in]: contactCandidates } },
      });

      if (convRecord) {
        if (!contactName) contactName = convRecord.name;
        if (!contactName || contactName.includes('@')) {
          contactName = convRecord.name;
        }
      }

      if (!phoneNumber && jid.endsWith('@s.whatsapp.net')) {
        phoneNumber = formatPhoneNumber(jid);
      }

      // 2. Consulta de foto real de alta resolução e recado via cliente Zapo
      let pictureUrl: string | null = null;
      let previewUrl: string | null = null;
      let aboutStatus: string | null = null;

      const client = zapoManager.getClient(connectionId);
      if (client) {
        const candidates = Array.from(new Set([jid, phoneJid, lidJid].filter(Boolean))) as string[];

        // Busca foto real em alta resolução ('image')
        for (const candidate of candidates) {
          try {
            const pic = await client.profile.getProfilePicture(candidate, 'image');
            if (pic?.url) {
              pictureUrl = pic.url;
              break;
            }
          } catch {}
        }

        // Busca thumbnail/preview ('preview')
        for (const candidate of candidates) {
          try {
            const pic = await client.profile.getProfilePicture(candidate, 'preview');
            if (pic?.url) {
              previewUrl = pic.url;
              if (!pictureUrl) pictureUrl = pic.url;
              break;
            }
          } catch {}
        }

        // Busca recado / status
        for (const candidate of candidates) {
          try {
            const st = await client.profile.getStatus(candidate);
            if (st?.status) {
              aboutStatus = st.status;
              break;
            }
          } catch {}
        }
      }

      // Se for grupo, extrai metadados completos de grupo
      const isGroup = jid.endsWith('@g.us');
      let groupDetails: any = null;

      if (isGroup) {
        let groupRecord = await Group.findOne({ where: { connectionId, jid } });
        let meta: any = null;
        if (client) {
          try {
            meta = await client.group.queryGroupMetadata(jid);
            if (meta) {
              await Group.upsert({
                connectionId,
                jid,
                name: meta.subject || groupRecord?.name || 'Grupo WhatsApp',
                description: meta.desc || groupRecord?.description || null,
                participantCount: meta.participants?.length || groupRecord?.participantCount || 0,
                metadata: {
                  creation: meta.creation,
                  owner: meta.owner,
                  restrict: meta.restrict,
                  announce: meta.announce,
                },
                lastSyncAt: new Date(),
              });
            }
          } catch {}
        }

        const participants = (meta?.participants || []).map((p: any) => {
          const participantJid = p.jid || p.id || '';
          const rawId = participantJid ? participantJid.split('@')[0].split(':')[0] : '';
          const digits = (p.phoneNumber || rawId || '').replace(/\D/g, '');
          const adminRole = p.isSuperAdmin ? 'superadmin' : p.isAdmin ? 'admin' : (p.admin || null);
          return {
            id: participantJid,
            jid: participantJid,
            lid: p.lid || (participantJid.endsWith('@lid') ? participantJid : null),
            admin: adminRole,
            phoneNumber: digits ? formatPhoneNumber(digits) : (p.phoneNumber ? formatPhoneNumber(p.phoneNumber) : null),
            cleanNumber: digits || null,
            waMeLink: digits && digits.length >= 8 ? `https://wa.me/${digits}` : null,
          };
        });

        groupDetails = {
          groupId: jid.split('@')[0],
          groupJid: jid,
          owner: meta?.owner || groupRecord?.metadata?.owner || null,
          creation: meta?.creation || groupRecord?.metadata?.creation || null,
          creationDate: (meta?.creation || groupRecord?.metadata?.creation) ? new Date((meta?.creation || groupRecord?.metadata?.creation) * 1000).toISOString() : null,
          participantCount: meta?.participants?.length || groupRecord?.participantCount || 0,
          restrict: Boolean(meta?.restrict ?? groupRecord?.metadata?.restrict),
          announce: Boolean(meta?.announce ?? groupRecord?.metadata?.announce),
          description: meta?.desc || groupRecord?.description || null,
          participants,
        };
      }

      // Se já tínhamos cache de foto no banco e a API do WhatsApp não retornou, usamos o cache
      if (!pictureUrl) {
        pictureUrl = convRecord?.profilePicUrl || contactRecord?.profilePicUrl || null;
      }

      // Se obtivemos foto nova, atualiza o cache no banco de dados
      if (pictureUrl) {
        if (convRecord && convRecord.profilePicUrl !== pictureUrl) {
          convRecord.profilePicUrl = pictureUrl;
          await convRecord.save();
        }
        if (contactRecord && contactRecord.profilePicUrl !== pictureUrl) {
          contactRecord.profilePicUrl = pictureUrl;
          await contactRecord.save();
        }
      }

      const rawClean = (phoneJid || jid).replace(/\D/g, '');

      res.json({
        success: true,
        name: contactName || (isGroup ? 'Grupo WhatsApp' : jid.split('@')[0]),
        phoneNumber: phoneNumber || (phoneJid ? formatPhoneNumber(phoneJid) : null),
        cleanNumber: !isGroup && rawClean.length >= 10 ? rawClean : null,
        waMeLink: !isGroup && rawClean.length >= 10 ? `https://wa.me/${rawClean}` : null,
        jid,
        phoneJid,
        lid: lidJid,
        profilePicUrl: pictureUrl,
        previewUrl: previewUrl || pictureUrl,
        about: aboutStatus,
        isGroup,
        groupId: isGroup ? jid.split('@')[0] : null,
        groupDetails,
      });
    } catch (error: any) {
      console.error('[ContactsController.getProfile] Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ferramenta de Desenvolvedor: Resolve Número, JID, LID e Metadados de Grupo
   */
  static async resolveDev(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { connectionId, query } = req.body;
      if (!connectionId || !query) {
        res.status(400).json({ error: 'connectionId e query são obrigatórios.' });
        return;
      }

      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId: req.user!.id },
      });
      if (!connection) {
        res.status(404).json({ error: 'Conexão não encontrada ou não autorizada.' });
        return;
      }

      const client = zapoManager.getClient(connectionId);
      const clean = String(query).trim();
      
      let targetJid = clean;
      if (clean.includes('@')) {
        targetJid = clean;
      } else {
        const digits = clean.replace(/\D/g, '');
        if (digits.length >= 17) {
          targetJid = `${digits}@g.us`;
        } else {
          targetJid = `${digits}@s.whatsapp.net`;
        }
      }

      const isGroup = targetJid.endsWith('@g.us');

      if (isGroup) {
        let meta: any = null;
        if (client) {
          try {
            meta = await client.group.queryGroupMetadata(targetJid);
          } catch {}
        }
        const groupRecord = await Group.findOne({ where: { connectionId, jid: targetJid } });
        const convRecord = await Conversation.findOne({ where: { connectionId, jid: targetJid } });

        let pictureUrl: string | null = null;
        if (client) {
          try {
            const pic = await client.profile.getProfilePicture(targetJid, 'image');
            pictureUrl = pic?.url || null;
          } catch {}
        }

        const participants = (meta?.participants || []).map((p: any) => {
          const participantJid = p.jid || p.id || '';
          const rawId = participantJid ? participantJid.split('@')[0].split(':')[0] : '';
          const digits = (p.phoneNumber || rawId || '').replace(/\D/g, '');
          const adminRole = p.isSuperAdmin ? 'superadmin' : p.isAdmin ? 'admin' : (p.admin || null);
          return {
            id: participantJid,
            jid: participantJid,
            lid: p.lid || (participantJid.endsWith('@lid') ? participantJid : null),
            admin: adminRole,
            phoneNumber: digits ? formatPhoneNumber(digits) : (p.phoneNumber ? formatPhoneNumber(p.phoneNumber) : null),
            cleanNumber: digits || null,
            waMeLink: digits && digits.length >= 8 ? `https://wa.me/${digits}` : null,
          };
        });

        res.json({
          success: true,
          type: 'group',
          input: query,
          groupId: targetJid.split('@')[0],
          groupJid: targetJid,
          name: meta?.subject || groupRecord?.name || convRecord?.name || 'Grupo WhatsApp',
          description: meta?.desc || groupRecord?.description || null,
          owner: meta?.owner || groupRecord?.metadata?.owner || null,
          creation: meta?.creation || groupRecord?.metadata?.creation || null,
          creationDate: (meta?.creation || groupRecord?.metadata?.creation) ? new Date((meta?.creation || groupRecord?.metadata?.creation) * 1000).toISOString() : null,
          participantCount: meta?.participants?.length || groupRecord?.participantCount || 0,
          restrict: Boolean(meta?.restrict ?? groupRecord?.metadata?.restrict),
          announce: Boolean(meta?.announce ?? groupRecord?.metadata?.announce),
          profilePicUrl: pictureUrl || convRecord?.profilePicUrl || null,
          participants,
        });
        return;
      }

      // Resolução de Contato Individual
      let phoneJid: string | null = null;
      let lid: string | null = null;
      let name: string | null = null;
      let phoneNumber: string | null = null;
      let about: string | null = null;
      let profilePicUrl: string | null = null;

      try {
        const rawDigits = targetJid.replace(/[^0-9]/g, '');
        const [rows]: any = await sequelize.query(
          `SELECT jid, lid, phone_number, display_name, push_name 
           FROM wa_mailbox_contacts 
           WHERE (jid = :q OR lid = :q OR phone_number = :q OR jid LIKE :qPattern OR lid LIKE :qPattern OR phone_number LIKE :qPattern) 
           LIMIT 1`,
          {
            replacements: {
              q: targetJid,
              qPattern: `%${rawDigits}%`,
            },
          }
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          phoneJid = r.phone_number || (r.jid?.endsWith('@s.whatsapp.net') ? r.jid : null);
          lid = r.lid || (r.jid?.endsWith('@lid') ? r.jid : null);
          name = r.display_name || r.push_name || null;
        }
      } catch {}

      const candidates = [targetJid, phoneJid, lid].filter(Boolean) as string[];
      const contactRec = await Contact.findOne({
        where: { connectionId, jid: { [Op.in]: candidates } },
      });
      const convRec = await Conversation.findOne({
        where: { connectionId, jid: { [Op.in]: candidates } },
      });

      if (!name) name = contactRec?.name || contactRec?.notifyName || convRec?.name || null;
      if (!phoneJid && targetJid.endsWith('@s.whatsapp.net')) phoneJid = targetJid;
      if (!lid && targetJid.endsWith('@lid')) lid = targetJid;

      const cleanDigits = (phoneJid || targetJid).replace(/\D/g, '');
      phoneNumber = cleanDigits ? formatPhoneNumber(cleanDigits) : null;

      if (client) {
        const liveCandidates = Array.from(new Set([targetJid, phoneJid, lid].filter(Boolean))) as string[];
        for (const cand of liveCandidates) {
          try {
            const pic = await client.profile.getProfilePicture(cand, 'image');
            if (pic?.url) {
              profilePicUrl = pic.url;
              break;
            }
          } catch {}
        }
        for (const cand of liveCandidates) {
          try {
            const st = await client.profile.getStatus(cand);
            if (st?.status) {
              about = st.status;
              break;
            }
          } catch {}
        }
      }

      if (!profilePicUrl) {
        profilePicUrl = convRec?.profilePicUrl || contactRec?.profilePicUrl || null;
      }

      res.json({
        success: true,
        type: 'individual',
        input: query,
        jid: phoneJid || targetJid,
        phoneJid: phoneJid || (targetJid.endsWith('@s.whatsapp.net') ? targetJid : null),
        lid: lid || (targetJid.endsWith('@lid') ? targetJid : null),
        phoneNumber: phoneNumber || (phoneJid ? formatPhoneNumber(phoneJid) : null),
        cleanNumber: cleanDigits || null,
        name: name || (cleanDigits ? formatPhoneNumber(cleanDigits) : targetJid.split('@')[0]),
        about,
        profilePicUrl,
        links: {
          waMe: cleanDigits ? `https://wa.me/${cleanDigits}` : null,
          directChatJid: phoneJid || targetJid,
        },
      });
    } catch (err: any) {
      console.error('[ContactsController.resolveDev] Error:', err);
      res.status(500).json({ error: err.message || 'Erro ao resolver dados de desenvolvedor.' });
    }
  }

  /**
   * Faz o download direto da foto de perfil em alta resolução
   */
  static async downloadProfilePicture(req: AuthRequest, res: Response): Promise<void> {
    try {
      let { connectionId, jid, conversationId } = req.query as {
        connectionId?: string;
        jid?: string;
        conversationId?: string;
      };

      if (!connectionId && conversationId) {
        const conv = await Conversation.findByPk(conversationId);
        if (conv) {
          connectionId = conv.connectionId;
          jid = conv.jid;
        }
      }

      if (!connectionId || !jid) {
        res.status(400).send('Parâmetros connectionId e jid são obrigatórios.');
        return;
      }

      // 1. Tenta obter a URL da foto
      let pictureUrl: string | null = null;
      let contactName: string = 'contato';

      const convRecord = await Conversation.findOne({ where: { connectionId, jid } });
      if (convRecord?.name) contactName = convRecord.name;
      if (convRecord?.profilePicUrl) pictureUrl = convRecord.profilePicUrl;

      const client = zapoManager.getClient(connectionId);
      if (client) {
        // Tenta buscar no Zapo
        let phoneJid: string | null = null;
        try {
          const [rows]: any = await sequelize.query(
            `SELECT phone_number FROM wa_mailbox_contacts WHERE (jid = :jid OR lid = :jid) LIMIT 1`,
            { replacements: { jid } }
          );
          if (rows && rows.length > 0) phoneJid = rows[0].phone_number;
        } catch {}

        const candidates = Array.from(new Set([jid, phoneJid].filter(Boolean))) as string[];
        for (const candidate of candidates) {
          try {
            const pic = await client.profile.getProfilePicture(candidate, 'image');
            if (pic?.url) {
              pictureUrl = pic.url;
              break;
            }
          } catch {}
        }
      }

      if (!pictureUrl) {
        res.status(404).send('Foto de perfil não encontrada ou privada no WhatsApp.');
        return;
      }

      // 2. Baixa a imagem diretamente do servidor do WhatsApp
      const response = await fetch(pictureUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        res.status(502).send('Falha ao baixar imagem do servidor do WhatsApp.');
        return;
      }

      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const safeFilename = `perfil_${contactName.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (error: any) {
      console.error('[ContactsController.downloadProfilePicture] Error:', error);
      res.status(500).send('Erro ao processar download da foto: ' + error.message);
    }
  }

  /**
   * Proxy de imagem para contornar qualquer restrição de CORS ou Referrer do WhatsApp no navegador
   */
  static async pictureProxy(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { url } = req.query as { url?: string };
      if (!url || (!url.startsWith('https://pps.whatsapp.net') && !url.startsWith('https://mmg.whatsapp.net'))) {
        res.status(400).send('URL inválida para proxy.');
        return;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        res.status(502).send('Falha ao buscar imagem do WhatsApp.');
        return;
      }

      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (error: any) {
      res.status(500).send('Erro no proxy de imagem: ' + error.message);
    }
  }
}
