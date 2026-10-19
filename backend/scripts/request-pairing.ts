import { initDatabase, WhatsAppConnection } from '../src/database/models/index.js';
import { zapoManager } from '../src/integrations/zapo/ZapoConnectionManager.js';

async function requestPairing() {
  console.log('Inicializando banco de dados...');
  await initDatabase();

  const conn = await WhatsAppConnection.findOne();
  if (!conn) {
    console.error('Nenhuma conexão encontrada.');
    process.exit(1);
  }

  const phone = '553499198782';
  console.log(`Conectando cliente para ${phone}...`);
  const client = await zapoManager.connect(conn.id, conn.userId);

  client.on('auth_qr', ({ qr }) => {
    console.log('[WA Event] QR Code gerado! Tamanho:', qr.length);
  });

  client.on('auth_pairing_required', () => {
    console.log('[WA Event] auth_pairing_required disparado! Pronto para solicitar código.');
  });

  console.log('Aguardando socket WhatsApp abrir...');
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      console.log('Timeout de espera do socket atingido.');
      resolve();
    }, 6000);

    client.once('auth_pairing_required', () => {
      clearTimeout(t);
      resolve();
    });
    client.once('auth_qr', () => {
      clearTimeout(t);
      resolve();
    });
  });

  console.log(`Solicitando Código de Pareamento para: ${phone}...`);
  try {
    const code = await client.auth.requestPairingCode(phone);
    console.log('\n======================================================');
    console.log('📲 CÓDIGO DE PAREAMENTO DO WHATSAPP GERADO:');
    console.log(`👉  ${code}  👈`);
    console.log('======================================================');
    console.log('No celular, abra o WhatsApp:');
    console.log('1. Toque nos 3 pontinhos (ou Configurações) > Aparelhos Conectados');
    console.log('2. Toque em "Conectar um Aparelho"');
    console.log('3. Toque em "Conectar com número de telefone"');
    console.log(`4. Digite o código: ${code}\n`);

    client.on('auth_paired', async ({ credentials }) => {
      console.log('\n🎉 SUCESSO! WhatsApp pareado com:', credentials?.meJid);
      console.log('Agora criando o grupo no WhatsApp real...');
      try {
        const metadata = await client.group.createGroup('🏛️ Arena Zaptroll RPG', ['553499274199@s.whatsapp.net']);
        console.log('🏛️ GRUPO CRIADO NO WHATSAPP REAL:', metadata.jid, metadata.subject);
        await client.message.send(metadata.jid, { type: 'text', text: '🏛️ Bem-vindos à Arena Política Zaptroll RPG! Digite /rpg para começar!' });
        console.log('✅ Mensagem /rpg enviada para o novo grupo real!');
      } catch (err: any) {
        console.error('Erro ao criar grupo no WhatsApp real:', err.message);
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 90000));
  } catch (err: any) {
    console.error('Erro ao solicitar código:', err.message);
  }

  process.exit(0);
}

requestPairing().catch(console.error);
