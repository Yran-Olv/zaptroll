import { initDatabase, WhatsAppConnection, Group, Conversation } from '../src/database/models/index.js';
import { zapoManager } from '../src/integrations/zapo/ZapoConnectionManager.js';
import { RpgCommandDispatcher } from '../src/modules/rpg/commands/RpgCommandDispatcher.js';

async function main() {
  console.log('Iniciando pareamento ativo com WhatsApp...');
  await initDatabase();

  const conn = await WhatsAppConnection.findOne();
  if (!conn) {
    console.error('Nenhuma conexão encontrada.');
    process.exit(1);
  }

  const phone = '553499198782';
  const client = await zapoManager.connect(conn.id, conn.userId);

  console.log('Aguardando handshake da conexão com o WhatsApp...');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.log('Continuando após espera inicial...');
      resolve();
    }, 6000);

    client.once('auth_pairing_required', () => {
      clearTimeout(timeout);
      resolve();
    });
    client.once('auth_qr', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  try {
    const code = await client.auth.requestPairingCode(phone);
    console.log('\n======================================================');
    console.log('📲 NOVO CÓDIGO DE PAREAMENTO GERADO (VÁLIDO POR 10 MINUTOS):');
    console.log(`👉👉👉   ${code}   👈👈👈`);
    console.log('======================================================');
    console.log('No celular, abra o WhatsApp:');
    console.log('1. Toque nos 3 pontinhos (ou Configurações) > Aparelhos Conectados');
    console.log('2. Toque em "Conectar um Aparelho"');
    console.log('3. Toque em "Conectar com número de telefone"');
    console.log(`4. Digite o código: ${code}\n`);

    let groupCreated = false;
    const triggerGroupCreation = async (meJid?: string) => {
      if (groupCreated) return;
      groupCreated = true;

      console.log('\n======================================================');
      console.log('🎉 SUCESSO! WHATSAPP CONECTADO E PRONTO!');
      console.log('Número conectado:', meJid || phone);
      console.log('======================================================\n');

      console.log('🚀 Criando grupo no WhatsApp real agora...');
      try {
        let groupMeta;
        try {
          groupMeta = await client.group.createGroup('🏛️ Arena Zaptroll RPG', ['553499274199@s.whatsapp.net']);
        } catch (firstErr: any) {
          console.warn('Tentativa com primeiro contato falhou, tentando segundo contato:', firstErr.message);
          groupMeta = await client.group.createGroup('🏛️ Arena Zaptroll RPG', ['553498274826@s.whatsapp.net']);
        }

        console.log(`✅ GRUPO CRIADO NO WHATSAPP REAL COM SUCESSO!`);
        console.log(`   Nome: ${groupMeta.subject}`);
        console.log(`   JID: ${groupMeta.jid}`);

        // Salvar grupo no banco
        await Group.upsert({
          connectionId: conn.id,
          jid: groupMeta.jid,
          name: groupMeta.subject,
          participantCount: 2,
          lastSyncAt: new Date(),
        });

        await Conversation.upsert({
          connectionId: conn.id,
          jid: groupMeta.jid,
          chatType: 'group',
          name: groupMeta.subject,
          unreadCount: 0,
          lastMessageText: 'Grupo criado para combate RPG',
          lastMessageTimestamp: new Date(),
        });

        console.log('📨 Enviando mensagem de boas-vindas no grupo real...');
        await client.message.send(groupMeta.jid, {
          type: 'text',
          text: '🏛️ *BEM-VINDOS AO ZAPTROLL RPG — LUTA POLÍTICA!* 🥊\n\nEste grupo oficial foi criado para batalhas de cartas, debates e comícios virtuais!\n\n🎮 *Comandos rápidos:*\n• */rpg* — Ver status do seu candidato\n• */lutarbot facil* — Iniciar duelo contra o Bot\n• */deck* — Ver suas cartas e energia\n• */top* — Ranking dos maiores políticos',
        });
        console.log('✅ Mensagem de boas-vindas enviada para o grupo real!');

        // Dispara o comando /rpg no grupo
        console.log('📨 Disparando menu /rpg...');
        await RpgCommandDispatcher.handleMessage({
          client,
          connectionId: conn.id,
          userId: conn.userId,
          remoteJid: groupMeta.jid,
          senderJid: meJid || `${phone}@s.whatsapp.net`,
          userName: 'Yran',
          text: '/rpg',
        });
        console.log('✅ Menu do /rpg disparado dentro do grupo real!');

        // Inicia duelo contra o bot
        setTimeout(async () => {
          console.log('🤖 Disparando duelo contra o bot na arena...');
          await RpgCommandDispatcher.handleMessage({
            client,
            connectionId: conn.id,
            userId: conn.userId,
            remoteJid: groupMeta.jid,
            senderJid: meJid || `${phone}@s.whatsapp.net`,
            userName: 'Yran',
            text: '/lutarbot facil',
          });
          console.log('✅ Batalha contra bot iniciada no grupo real!');
        }, 3000);
      } catch (grpErr: any) {
        console.error('❌ Erro ao criar grupo no WhatsApp real:', grpErr.message);
      }
    };

    client.on('connection', async (ev: any) => {
      console.log('[Status WhatsApp]', ev.status, ev.reason || '');
      if (ev.status === 'open') {
        await triggerGroupCreation();
      }
    });

    client.on('auth_paired', async ({ credentials }) => {
      console.log('[WA Event] auth_paired disparado!');
      await triggerGroupCreation(credentials?.meJid);
    });

    // Manter o processo vivo indefinidamente em background
    setInterval(() => {
      // heartbeat
    }, 30000);
  } catch (err: any) {
    console.error('Erro ao gerar código:', err.message);
  }
}

main().catch(console.error);
