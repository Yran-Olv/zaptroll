import { WaClient } from 'zapo-js';
import { RpgPlayer, RpgCampaignProgress, RpgCharacter } from '../models/index.js';
import { DuelService } from './DuelService.js';

export interface CampaignChapter {
  chapter: number;
  title: string;
  lore: string;
  bossId: string;
  bossDifficulty: 'facil' | 'normal' | 'dificil' | 'chefe';
  choices: {
    text: string;
    ethicsDelta: number;
    coinsReward: number;
  }[];
}

export const CAMPAIGN_CHAPTERS: Record<number, CampaignChapter> = {
  1: {
    chapter: 1,
    title: 'A Promessa do Bairro',
    lore: 'Você começa como líder comunitário de um bairro esquecido. O velho cacique local, Doutor Promessa, diz que o asfalto só chega se você fechar aliança com ele e jurar fidelidade ao seu grupo.',
    bossId: 'doutor_promessa',
    bossDifficulty: 'facil',
    choices: [
      {
        text: 'Denunciar a chantagem no grupo da vizinhança e mobilizar os moradores (+15 Ética).',
        ethicsDelta: 15,
        coinsReward: 50,
      },
      {
        text: 'Aceitar o acordo sob a mesa para conseguir o asfalto rápido e colher os louros (+15 Maquiavelismo, +150 R$).',
        ethicsDelta: -15,
        coinsReward: 150,
      },
    ],
  },
  2: {
    chapter: 2,
    title: 'A Tribuna da Discórdia',
    lore: 'Eleito vereador, você descobre que o plenário é dominado pelos berros do Capitão Palanque, que planeja aprovar um projeto absurdo na base do grito e da intimidação.',
    bossId: 'capitao_palanque',
    bossDifficulty: 'normal',
    choices: [
      {
        text: 'Desmascarar os dados falsos do projeto em plenário com relatórios técnicos (+15 Ética).',
        ethicsDelta: 15,
        coinsReward: 80,
      },
      {
        text: 'Contratar disparos de memes anônimos para destruir a reputação do Capitão (+15 Maquiavelismo, +200 R$).',
        ethicsDelta: -15,
        coinsReward: 200,
      },
    ],
  },
  3: {
    chapter: 3,
    title: 'O Comitê Invisível',
    lore: 'Você chega à cobiçada comissão de constituição. Nos bastidores, o Estrategista Fantasma engaveta todas as propostas com manobras regimentais obscuras.',
    bossId: 'estrategista_fantasma',
    bossDifficulty: 'normal',
    choices: [
      {
        text: 'Passar as noites estudando as brechas do regimento interno para derrotá-lo nas regras (+15 Ética).',
        ethicsDelta: 15,
        coinsReward: 100,
      },
      {
        text: 'Negociar cargos em secretarias para cooptar os aliados do comitê (+15 Maquiavelismo, +250 R$).',
        ethicsDelta: -15,
        coinsReward: 250,
      },
    ],
  },
  4: {
    chapter: 4,
    title: 'O Ajuste Fiscal',
    lore: 'Como relator orçamentário em ascensão, Dona Reforma exige cortes drásticos nas verbas sociais para manter o superávit impecável em suas planilhas de ferro.',
    bossId: 'dona_reforma',
    bossDifficulty: 'normal',
    choices: [
      {
        text: 'Proteger o orçamento popular e peitar os cortes das grandes bancadas (+15 Ética).',
        ethicsDelta: 15,
        coinsReward: 120,
      },
      {
        text: 'Apoiar o arrocho total e agradar o grande mercado em troca de apoio de peso (+15 Maquiavelismo, +300 R$).',
        ethicsDelta: -15,
        coinsReward: 300,
      },
    ],
  },
  5: {
    chapter: 5,
    title: 'O Levante da Base',
    lore: 'As massas ocupam a esplanada lideradas pelo Camarada Tropa. A pressão popular paralisa o parlamento e ameaça derrubar todo o governo.',
    bossId: 'camarada_tropa',
    bossDifficulty: 'dificil',
    choices: [
      {
        text: 'Subir no palanque aberto da manifestação, ouvir as reivindicações e costurar um acordo limpo (+15 Ética).',
        ethicsDelta: 15,
        coinsReward: 150,
      },
      {
        text: 'Pagar infiltrados para rachar o movimento e dispersar os protestos (+15 Maquiavelismo, +350 R$).',
        ethicsDelta: -15,
        coinsReward: 350,
      },
    ],
  },
  6: {
    chapter: 6,
    title: 'O Salão dos Acordos',
    lore: 'Na antessala do poder máximo, o temido Lobista Sombrio opera com malas lacradas e dossiês de espionagem. Ele promete sua eleição em troca do enterro de uma CPI.',
    bossId: 'lobista_sombrio',
    bossDifficulty: 'dificil',
    choices: [
      {
        text: 'Vazar o dossiê da corrupção para o país e enfrentar a fúria das raposas velhas (+20 Ética).',
        ethicsDelta: 20,
        coinsReward: 200,
      },
      {
        text: 'Aceitar a pasta secreta e garantir o controle supremo da máquina partidária (+20 Maquiavelismo, +500 R$).',
        ethicsDelta: -20,
        coinsReward: 500,
      },
    ],
  },
  7: {
    chapter: 7,
    title: 'A Grande Eleição Final',
    lore: 'O Grande Debate da Presidência da República ao vivo! O último obstáculo entre você e a faixa presidencial é O Ex-Tudo, o camaleão que já foi situação, oposição e tudo o que convém.',
    bossId: 'ex_tudo',
    bossDifficulty: 'chefe',
    choices: [
      {
        text: 'Discursar com verdade e ética, propondo refundar as instituições da nação (+25 Ética).',
        ethicsDelta: 25,
        coinsReward: 300,
      },
      {
        text: 'Soltar a mãe de todas as fake news nos últimos 30 segundos do debate (+25 Maquiavelismo, +1000 R$).',
        ethicsDelta: -25,
        coinsReward: 1000,
      },
    ],
  },
};

export class CampaignService {
  /**
   * Consulta o estado atual da campanha de um jogador
   */
  public static async getProgress(phone: string, userName?: string): Promise<{ player: RpgPlayer; progress: RpgCampaignProgress }> {
    let player = await RpgPlayer.findOne({ where: { whatsappPhone: phone } });
    if (!player) {
      player = await RpgPlayer.create({
        whatsappPhone: phone,
        name: userName || 'Candidato',
      });
    }

    let progress = await RpgCampaignProgress.findOne({ where: { playerId: player.id } });
    if (!progress) {
      progress = await RpgCampaignProgress.create({
        playerId: player.id,
        currentChapter: 1,
        completedChapters: [],
        reputationScore: 0,
        choicesMade: {},
      });
    }

    return { player, progress };
  }

  /**
   * Renderiza a mensagem de campanha no WhatsApp (/campanha)
   */
  public static async showCampaignStatus(phone: string, userName?: string): Promise<string> {
    const { player, progress } = await this.getProgress(phone, userName);
    const chapterNum = progress.currentChapter;

    if (chapterNum > 7) {
      const rep = progress.reputationScore;
      const finalTitle = rep >= 30 ? '🕊️ Estadista da História' : rep <= -30 ? '👑 Imperador do Centrão' : '⚖️ Político Pragmático';

      return [
        `🏛️ *CAMPANHA POLÍTICA CONCLUÍDA!* 🏆`,
        `Parabéns, ${player.name}! Você completou todos os 7 capítulos da campanha.`,
        '',
        `📜 *Seu Desfecho Histórico:* ${finalTitle}`,
        `🧭 *Reputação Final:* ${progress.reputationScore > 0 ? `+${progress.reputationScore} (Ético)` : `${progress.reputationScore} (Maquiavélico)`}`,
        `💰 *Patrimônio:* ${player.coins} R$`,
        '',
        `_Você conquistou a faixa presidencial! Continue disputando duelos no ranking (/duelo)._`,
      ].join('\n');
    }

    const chapter = CAMPAIGN_CHAPTERS[chapterNum];
    if (!chapter) return 'Capítulo não encontrado.';

    const boss = await RpgCharacter.findByPk(chapter.bossId);
    const bossName = boss ? `${boss.name} ${boss.avatarEmoji}` : 'Chefe da Região';

    const choice1 = chapter.choices[0];
    const choice2 = chapter.choices[1];

    const reputationBar = progress.reputationScore >= 0 ? `😇 Ética (+${progress.reputationScore})` : `😈 Maquiavelismo (${progress.reputationScore})`;

    const lines = [
      `📖 *MODO CAMPANHA — CAPÍTULO ${chapter.chapter}/7*`,
      `🏛️ *${chapter.title}*`,
      '',
      `📜 *Cenário:*`,
      `${chapter.lore}`,
      '',
      `🧭 *Sua Reputação Atual:* ${reputationBar}`,
      `🥊 *Adversário do Capítulo:* *${bossName}* (Dificuldade: ${chapter.bossDifficulty.toUpperCase()})`,
      '',
      `⚖️ *Decisão de Gabinete:*`,
      `1️⃣ ${choice1.text}`,
      `2️⃣ ${choice2.text}`,
      '',
      `👉 Digite */campanha 1* ou */campanha 2* para tomar sua decisão e enfrentar o chefe!`,
      `👉 Ou digite */campanha lutar* para ir direto ao confronto no ringue!`,
    ];

    return lines.join('\n');
  }

  /**
   * Processa a escolha do capítulo e inicia a batalha contra o chefe do capítulo
   */
  public static async makeChoiceAndFight(params: {
    connectionId: string;
    targetJid: string;
    phone: string;
    userName: string;
    choiceIndex?: number;
    client: WaClient;
  }): Promise<string> {
    const { connectionId, targetJid, phone, userName, choiceIndex, client } = params;
    const { player, progress } = await this.getProgress(phone, userName);

    if (progress.currentChapter > 7) {
      return '🏆 Você já concluiu todos os capítulos da campanha!';
    }

    const chapter = CAMPAIGN_CHAPTERS[progress.currentChapter];
    if (!chapter) return 'Capítulo inválido.';

    let rewardMessage = '';

    if (choiceIndex === 1 || choiceIndex === 2) {
      const choice = chapter.choices[choiceIndex - 1];
      progress.reputationScore += choice.ethicsDelta;
      player.coins += choice.coinsReward;

      const choicesObj = { ...(progress.choicesMade || {}) };
      choicesObj[`capitulo_${chapter.chapter}`] = choiceIndex;
      progress.choicesMade = choicesObj;

      await progress.save();
      await player.save();

      rewardMessage = `⚖️ *Decisão registrada!* Verba obtida: +${choice.coinsReward} R$.\n\n`;
    }

    // Iniciar a batalha contra o Boss do capítulo
    const bossChar = await RpgCharacter.findByPk(chapter.bossId);
    const bossName = bossChar ? `${bossChar.name} (Chefe Cap. ${chapter.chapter})` : `Chefe Cap. ${chapter.chapter}`;

    // Disparar bot battle customizado para a campanha
    const result = await DuelService.startBotBattle({
      connectionId,
      targetJid,
      phone,
      userName,
      difficulty: chapter.bossDifficulty,
      client,
    });

    return `${rewardMessage}🚨 *COMBATE DE CAMPANHA:* Você está entrando no debate decisivo contra *${bossName}*!\n${result}`;
  }

  /**
   * Chamado após vitória em batalha para checar avanço de capítulo
   */
  public static async onBattleWon(playerId: string, difficulty?: string): Promise<string | null> {
    const progress = await RpgCampaignProgress.findOne({ where: { playerId } });
    if (!progress || progress.currentChapter > 7) return null;

    const chapter = CAMPAIGN_CHAPTERS[progress.currentChapter];
    if (!chapter) return null;

    // Se venceu combate compatível com a dificuldade do capítulo
    if (difficulty === chapter.bossDifficulty || difficulty === 'chefe') {
      const completed = [...(progress.completedChapters || []), progress.currentChapter];
      progress.completedChapters = Array.from(new Set(completed));
      progress.currentChapter += 1;
      await progress.save();

      return `🎉 *CAPÍTULO ${chapter.chapter} CONCLUÍDO COM SUCESSO!* Você derrotou o líder político da região e avançou na campanha nacional. Digite */campanha* para ver o próximo desafio!`;
    }

    return null;
  }
}
