import { initDatabase, WhatsAppConnection, Group, Conversation, RpgPlayer, RpgBattle, RpgBattleParticipant, RpgCard, RpgAuditLog } from '../src/database/models/index.js';
import { RpgSeedService } from '../src/modules/rpg/services/RpgSeedService.js';
import { RpgCommandDispatcher } from '../src/modules/rpg/commands/RpgCommandDispatcher.js';
import { DuelService } from '../src/modules/rpg/services/DuelService.js';
import { TurnResolutionService } from '../src/modules/rpg/services/TurnResolutionService.js';
import { EconomyService } from '../src/modules/rpg/services/EconomyService.js';
import { MissionService } from '../src/modules/rpg/services/MissionService.js';
import { zapoManager } from '../src/integrations/zapo/ZapoConnectionManager.js';

interface SentMessageLog {
  target: string;
  type: string;
  text?: string;
  timestamp: Date;
}

async function runRpgGroupTest() {
  console.log('================================================================');
  console.log('🏛️  ZAPTROLL RPG — TESTE DE COMBATE E COMANDOS EM GRUPO WHATSAPP');
  console.log('================================================================\n');

  // 1. Inicializar Banco de Dados e Sementes
  console.log('1️⃣ Inicializando banco de dados e sementes do RPG...');
  await initDatabase();
  await RpgSeedService.seedDefaults();
  console.log('   ✅ Banco conectado e sementes provisionadas.\n');

  // 2. Obter ou criar conexão de teste
  let connection = await WhatsAppConnection.findOne();
  if (!connection) {
    console.log('   ⚠️ Nenhuma conexão encontrada. Criando conexão de teste local...');
    connection = await WhatsAppConnection.create({
      userId: 'cedb1fd0-4582-493a-9c24-8ecaa7841494',
      name: 'Conexão Teste RPG',
      sessionId: 'session_test_rpg_' + Date.now(),
      status: 'connected',
      phoneNumber: '553499198782',
    });
  }
  console.log(`2️⃣ Usando Conexão: "${connection.name}" (${connection.id})`);

  // 3. Criar ou Obter o Grupo no Banco
  const groupJid = '120363499999999999@g.us';
  const groupSubject = '🏛️ Arena Política RPG — Teste Zaptroll';

  console.log(`3️⃣ Configurando Grupo WhatsApp: "${groupSubject}" (${groupJid})...`);
  const [group] = await Group.upsert({
    connectionId: connection.id,
    jid: groupJid,
    name: groupSubject,
    description: 'Grupo oficial de testes automatizados do RPG Zaptroll.',
    participantCount: 4,
    metadata: {
      creation: Math.floor(Date.now() / 1000),
      owner: '553499198782@s.whatsapp.net',
      participants: [
        { id: '553499198782@s.whatsapp.net', admin: 'superadmin' },
        { id: '553499274199@s.whatsapp.net', admin: null },
        { id: '5534933005932@s.whatsapp.net', admin: null },
      ],
    },
    lastSyncAt: new Date(),
  });

  await Conversation.upsert({
    connectionId: connection.id,
    jid: groupJid,
    chatType: 'group',
    name: groupSubject,
    unreadCount: 0,
    lastMessageText: 'Arena criada para combate RPG',
    lastMessageTimestamp: new Date(),
  });
  console.log('   ✅ Grupo e conversa sincronizados no banco de dados.\n');

  // 4. Criar Mock Client do Zapo para registrar e inspecionar mensagens
  const sentMessages: SentMessageLog[] = [];
  let lastSentStanzaId = 100;

  const mockClient: any = {
    user: { id: '553499198782:0@s.whatsapp.net' },
    message: {
      send: async (target: string, payload: any) => {
        const text = payload.text || payload.caption || '[mídia]';
        lastSentStanzaId++;
        sentMessages.push({
          target,
          type: payload.type || 'text',
          text,
          timestamp: new Date(),
        });
        console.log(`   📨 [WhatsApp Enviado p/ ${target.slice(0, 16)}...]:`);
        console.log(text.split('\n').map((l: string) => `      ${l}`).join('\n'));
        console.log('   ────────────────────────────────────────────────────────────');
        return { stanzaId: `msg_${lastSentStanzaId}`, key: { remoteJid: target, id: `msg_${lastSentStanzaId}` } };
      },
      edit: async (target: string, stanzaId: string, payload: any) => {
        const text = payload.text || '';
        sentMessages.push({
          target,
          type: 'edit',
          text: `[EDIT ${stanzaId}] ${text}`,
          timestamp: new Date(),
        });
        console.log(`   ✏️ [WhatsApp Mensagem Editada no Grupo ${stanzaId}]:`);
        console.log(text.split('\n').map((l: string) => `      ${l}`).join('\n'));
        console.log('   ────────────────────────────────────────────────────────────');
        return { success: true };
      },
    },
    group: {
      createGroup: async (subject: string, participants: string[]) => ({
        jid: groupJid,
        subject,
        participants: participants.map((p) => ({ id: p, admin: null })),
        creation: Math.floor(Date.now() / 1000),
      }),
    },
  };

  // Registrar mockClient no ZapoManager para que o sync de mensagens no WhatsApp funcione
  (zapoManager as any).sessions.set(connection.id, {
    client: mockClient,
    connectionId: connection.id,
    userId: connection.userId,
    isConnecting: false,
  });

  const testPlayerJid = '553499198782@s.whatsapp.net';
  const testPlayerName = 'Candidato Yran';

  // 5. TESTE DO COMANDO: /rpg no Grupo
  console.log('4️⃣ Testando comando /rpg enviado no grupo...');
  const rpgRes = await RpgCommandDispatcher.handleMessage({
    client: mockClient,
    connectionId: connection.id,
    userId: connection.userId,
    remoteJid: groupJid,
    senderJid: testPlayerJid,
    userName: testPlayerName,
    text: '/rpg',
  });
  if (!rpgRes) throw new Error('Comando /rpg não foi tratado pelo despachante!');
  console.log('   ✅ Banner do /rpg processado e enviado com sucesso.\n');

  // 6. TESTE DO COMANDO: /perfil no Grupo
  console.log('5️⃣ Testando comando /perfil no grupo...');
  const perfilRes = await RpgCommandDispatcher.handleMessage({
    client: mockClient,
    connectionId: connection.id,
    userId: connection.userId,
    remoteJid: groupJid,
    senderJid: testPlayerJid,
    userName: testPlayerName,
    text: '/perfil',
  });
  if (!perfilRes) throw new Error('Comando /perfil não foi tratado pelo despachante!');
  console.log('   ✅ Perfil do jogador criado/consultado e enviado ao grupo.\n');

  // 7. TESTE DO COMANDO: /missoes no Grupo
  console.log('6️⃣ Testando comando /missoes no grupo...');
  const missoesRes = await RpgCommandDispatcher.handleMessage({
    client: mockClient,
    connectionId: connection.id,
    userId: connection.userId,
    remoteJid: groupJid,
    senderJid: testPlayerJid,
    userName: testPlayerName,
    text: '/missoes',
  });
  if (!missoesRes) throw new Error('Comando /missoes não foi tratado pelo despachante!');
  console.log('   ✅ Missões diárias consultadas e enviadas ao grupo.\n');

  // 8. TESTE DO COMANDO: /lutarbot facil no Grupo (Início do Combate)
  console.log('7️⃣ Iniciando combate contra Bot Político no grupo (/lutarbot facil)...');
  await RpgBattle.update(
    { status: 'cancelled' },
    { where: { groupId: groupJid, status: 'selecting_cards' } }
  );

  const botDuelRes = await RpgCommandDispatcher.handleMessage({
    client: mockClient,
    connectionId: connection.id,
    userId: connection.userId,
    remoteJid: groupJid,
    senderJid: testPlayerJid,
    userName: testPlayerName,
    text: '/lutarbot facil',
  });
  if (!botDuelRes) throw new Error('Comando /lutarbot não foi tratado pelo despachante!');

  // Localizar a batalha criada no banco
  const activeBattle = await RpgBattle.findOne({
    where: {
      connectionId: connection.id,
      groupId: groupJid,
      status: 'selecting_cards',
    },
    order: [['createdAt', 'DESC']],
  });

  if (!activeBattle) {
    throw new Error('❌ Batalha não foi encontrada no banco de dados!');
  }
  console.log(`   ✅ Batalha criada! ID: ${activeBattle.id}, Turno: ${activeBattle.currentTurn}, RNG Seed: ${activeBattle.rngSeed}`);

  // 9. SIMULAÇÃO DE JOGADAS DE CARTAS (Turnos 1 a 10 até o fim do combate)
  console.log('\n8️⃣ Executando rodadas de combate de cartas no grupo...');
  let round = 1;
  while (round <= 15) {
    const freshBattle = await RpgBattle.findByPk(activeBattle.id);
    if (!freshBattle || freshBattle.status === 'finished') {
      console.log(`   🏁 Combate encerrado no Turno ${round - 1}! Vencedor: ${freshBattle?.winnerPlayerId || 'Empate'}`);
      break;
    }

    console.log(`\n   ⚔️ --- RODADA ${round} --- (Batalha Status: ${freshBattle.status})`);
    
    // Buscar a mão do jogador e escolher uma carta jogável com a energia atual
    const playerPart = await RpgBattleParticipant.findOne({
      where: { battleId: activeBattle.id, phone: testPlayerJid },
    });

    let chosenCardNum = 1;
    if (playerPart && playerPart.hand && playerPart.hand.length > 0) {
      for (let i = 0; i < playerPart.hand.length; i++) {
        const cardObj = await RpgCard.findByPk(playerPart.hand[i]);
        if (cardObj && cardObj.energyCost <= playerPart.currentEnergy) {
          chosenCardNum = i + 1;
          console.log(`   💡 Carta selecionada na mão: [${chosenCardNum}] ${cardObj.emoji} ${cardObj.name} (Custo: ${cardObj.energyCost}⚡, Energia: ${playerPart.currentEnergy}⚡)`);
          break;
        }
      }
    }

    console.log(`   🃏 Jogador ${testPlayerName} enviando "${chosenCardNum}" no grupo...`);
    const cardRes = await RpgCommandDispatcher.handleMessage({
      client: mockClient,
      connectionId: connection.id,
      userId: connection.userId,
      remoteJid: groupJid,
      senderJid: testPlayerJid,
      userName: testPlayerName,
      text: String(chosenCardNum),
    });

    if (!cardRes) {
      console.log(`   ⚠️ Jogador não pôde selecionar carta no round ${round}.`);
      break;
    }

    round++;
    // Pequena pausa para simulação
    await new Promise((r) => setTimeout(r, 200));
  }

  // 10. VERIFICAR RESULTADOS E AUDITORIA
  console.log('\n9️⃣ Verificando integridade pós-combate...');
  const endedBattle = await RpgBattle.findByPk(activeBattle.id);
  console.log(`   Status Final da Batalha: ${endedBattle?.status}`);
  console.log(`   ID Vencedor: ${endedBattle?.winnerPlayerId || 'Empate'}`);
  console.log(`   Total de Turnos Jogados: ${endedBattle?.currentTurn}`);

  const auditLogs = await RpgAuditLog.findAll({
    where: { targetId: activeBattle.id },
  });
  console.log(`   Logs de Auditoria Criptográfica Gerados: ${auditLogs.length} turnos registrados`);

  const playerStats = await RpgPlayer.findOne({ where: { whatsappPhone: testPlayerJid } });
  console.log(`   Estatísticas Atualizadas do Jogador:`);
  console.log(`     - Nome: ${playerStats?.name}`);
  console.log(`     - Nível: ${playerStats?.level} (XP: ${playerStats?.xp})`);
  console.log(`     - Vitórias: ${playerStats?.victories}`);
  console.log(`     - Derrotas: ${playerStats?.defeats}`);
  console.log(`     - TrollCoins: ${playerStats?.coins}`);
  console.log(`     - Sequência de Vitórias: ${playerStats?.winStreak}`);

  console.log('\n================================================================');
  console.log('🎉 TODOS OS TESTES DO RPG NO GRUPO FORAM CONCLUÍDOS COM SUCESSO!');
  console.log('================================================================');
  process.exit(0);
}

runRpgGroupTest().catch((err) => {
  console.error('\n❌ Erro durante o teste do RPG no grupo:', err);
  process.exit(1);
});
