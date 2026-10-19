import { CombatEvent, CombatTurnResult } from '../engine/CombatEngine.js';
import { RpgBattleParticipant, RpgBattleTurn, RpgBattle } from '../models/index.js';

export interface GeneratedTurnNarrative {
  narrativeText: string;
  commentatorLine: string | null;
  historyLine: string;
}

export class BattleNarratorService {
  /**
   * Limpa o nome do lutador, removendo "(Bot)" duplicado e aplicando emojis elegantes
   */
  public static cleanFighterName(name: string, isBot?: boolean): string {
    if (!name) return 'Candidato';
    let clean = name.replace(/\(Bot\)/gi, '').replace(/\(CHEFE\)/gi, '').trim();

    if (isBot) {
      if (clean.toLowerCase().includes('lobista') || clean.toLowerCase().includes('sombrio')) {
        return `${clean} 💀`;
      }
      return `${clean} 🤖`;
    }
    return clean;
  }

  /**
   * Renderiza a barra de vida com 10 blocos e cores dinâmicas estritas:
   * > 60%: Verde (🟩)
   * 30% a 60%: Amarelo (🟨)
   * < 30%: Vermelho (🟥)
   */
  public static renderHpBar(current: number, max: number): string {
    const safeMax = Math.max(1, max);
    const safeCurrent = Math.max(0, Math.min(safeMax, current));
    const pct = safeCurrent / safeMax;
    const totalBlocks = 10;
    const filled = Math.round(pct * totalBlocks);

    let color = '🟩';
    if (pct < 0.3) {
      color = '🟥';
    } else if (pct <= 0.6) {
      color = '🟨';
    }

    const filledStr = color.repeat(Math.max(0, filled));
    const emptyStr = '⬜'.repeat(Math.max(0, totalBlocks - filled));
    return `${filledStr}${emptyStr} ${safeCurrent}/${safeMax}`;
  }

  /**
   * Templates ricos para narração em texto corrido (estilo transmissão esportiva e rádio político)
   */
  private static readonly MUTUAL_ATTACK_TEMPLATES = [
    'Os dois sacaram o microfone ao mesmo tempo e o plenário foi à loucura! {p1} disparou {c1} acertando {d1}; {p2} respondeu na mesma moeda com {c2}, tirando {d2}. Ninguém recua um milímetro nesta votação!',
    'Bateu lá, levou cá em plenário! {p1} abriu o discurso com {c1} acertando em cheio ({d1} de dano), mas {p2} não deixou barato e rebateu com {c2} ({d2} de dano). O clima esquentou na bancada!',
    'Trocação franca no centro da arena! {p1} encaixou {c1} ({d1} de dano), enquanto {p2} emendou {c2} na jugular ({d2} de dano). A plateia está de pé gritando "Pede vistas!"!',
    'Guerra de dossiês em pleno horário nobre! {p1} desferiu {c1} provocando {d1} de estrago; {p2} revidou de imediato com {c2} ({d2} de dano). O debate virou um campo de batalha!',
    'Sem tempo para pedidos de ordem! {p1} soltou o verbo com {c1} ({d1} de dano) e {p2} respondeu com um contragolpe fulminante de {c2} ({d2} de dano). Os dois sentiram o impacto!',
    'Que sequência insana no plenário! {p1} avançou com {c1} arrancando {d1} de vida, mas {p2} devolveu na velocidade da luz com {c2} ({d2} de dano). A Mesa Diretora perdeu o controle!',
  ];

  private static readonly CRIT_TEMPLATES = [
    'BOMBA NO PLENÁRIO! {attacker} achou uma brecha regimental e cravou um CRÍTICO com {card}! Foram estarrecedores {damage} de dano que deixaram {target} completamente desorientado!',
    'QUE PAULADA! {attacker} acertou em cheio no ponto fraco de {target} com {card}! Um acerto CRÍTICO avassalador de {damage} de dano que ecoou por todo o Congresso!',
    'MANCHETE URGENTE! {attacker} canalizou toda a fúria da oposição em um CRÍTICO estarrecedor de {card}, triturando {damage} de vida de {target}!',
    'GOLPE DE MESTRE! {attacker} pegou {target} de surpresa com {card}! Dano CRÍTICO de {damage} pontos! A assessoria de {target} já prepara a nota de repúdio!',
    'DIRETO NA JUGULAR! {attacker} não teve piedade e emplacou {card} com potência máxima ({damage} de dano). {target} cambaleou até a tribuna!',
  ];

  private static readonly DODGE_TEMPLATES = [
    '{attacker} tentou emplacar {card}, mas {target} ativou o foro privilegiado e se esquivou com a elegância de quem manobra um requerimento de urgência!',
    'PASSOU NO VÁCUO! {attacker} veio com tudo para cima usando {card}, porém {target} leu a jogada, pediu vistas e desviou sem levar um único arranhão!',
    'MANOBRA REGIMENTAL! O ataque {card} de {attacker} foi certeiro no ar, mas {target} sumiu das vistas com uma esquiva acrobática digna de CPI!',
    'DEU EM NADA! {attacker} investiu pesado com {card}, mas {target} saiu pela tangente da comissão e esquivou-se com maestria absoluta!',
    'ESQUIVA ESPETACULAR! {target} viu o golpe {card} vindo de longe, deu um passo lateral no plenário e fez {attacker} bater na bancada vazia!',
  ];

  private static readonly BLOCK_TEMPLATES = [
    'BLINDAGEM PESADA! {attacker} disparou {card}, mas a defesa impenetrável de {target} absorveu o impacto quase por inteiro! Burocracia pura em ação!',
    'PAREDE DE REQUERIMENTOS! {attacker} tentou causar estrago com {card}, mas {target} levantou um escudo regimental inquebrável, amortecendo o golpe!',
    'ARQUIVAMENTO SUMÁRIO! O golpe {card} de {attacker} bateu na blindagem sólida de {target} e perdeu força. A defesa está de parabéns!',
    'RESISTÊNCIA FÉRREA! {target} cruzou os braços e suportou o trator de {card} de {attacker} com um bloqueio cirúrgico.',
  ];

  private static readonly STATUS_TEMPLATES = [
    'ESCÂNDALO INSTALADO! {attacker} emplacou {card} ({damage} de dano) e agora {target} está sob {status}! O desgaste político vai corroer sua barra a cada turno!',
    'REPUTAÇÃO EM RISCO! Além de sofrer com {card}, {target} agora foi enquadrado em {status}! Qualquer passo em falso pode ser fatal!',
    'OPERAÇÃO DEFLAGRADA! {attacker} instaurou {status} em {target} com {card}! A pressão popular subiu e os holofotes estão queimando!',
    'DIREITO DE RESPOSTA NEGADO! {attacker} acertou {card} e amarrou {target} no efeito {status}. O plenário inteiro está de olho!',
  ];

  private static readonly HEAL_TEMPLATES = [
    'ARTICULAÇÃO DE BASTIDORES! {actor} acionou {card} e costurou um acordo suprapartidário, recuperando +{heal} de vida enquanto o plenário assistia estupefato!',
    'FÔLEGO NOVO NO MANDATO! {actor} utilizou {card} para reabastecer as energias e restaurar +{heal} de saúde política. A oposição não esperava essa manobra!',
    'ACORDO NO CAFÉZINHO! Com {card}, {actor} remendou sua base parlamentar e regenerou +{heal} de vida no momento mais oportuno!',
  ];

  private static readonly COMMENTATOR_LINES = [
    '🗣️ Comentarista: "Se esse debate continuar nesse ritmo, até o Diário Oficial vai sair mais cedo amanhã!"',
    '🗣️ Comentarista: "O assessor de imprensa já está redigindo a nota de repúdio antes mesmo do próximo turno!"',
    '🗣️ Comentarista: "Alguém chame o corregedor, porque isso aqui não foi um debate, foi um atropelamento regimental!"',
    '🗣️ Comentarista: "A oposição está tonta e a base aliada já começou a debandada!"',
    '🗣️ Comentarista: "Quem piscar agora perde o mandato! Clima tenso na bancada!"',
    '🗣️ Comentarista: "Com essa porcentagem de Ibope, o adversário não se elege nem para síndico de condomínio!"',
    '🗣️ Comentarista: "Uma jogada digna de bastidores de Brasília: rápida, dolorosa e sem recibo!"',
    '🗣️ Comentarista: "A bancada do fundão está eufórica! Ninguém segura esse ímpeto eleitoral!"',
  ];

  /**
   * Constrói o bloco narrativo completo de um turno resolvido de forma determinística
   */
  public static generateTurnNarrative(params: {
    turnNumber: number;
    rngSeed: number;
    p1: RpgBattleParticipant;
    p2: RpgBattleParticipant;
    combatResult: CombatTurnResult;
  }): GeneratedTurnNarrative {
    const { turnNumber, rngSeed, p1, p2, combatResult } = params;
    const p1Name = this.cleanFighterName(p1.name, p1.isBot);
    const p2Name = this.cleanFighterName(p2.name, p2.isBot);

    const events = combatResult.events || [];
    const critEvent = events.find((e) => e.type === 'crit');
    const dodgeEvent = events.find((e) => e.type === 'dodge');
    const blockEvent = events.find((e) => e.type === 'block');
    const statusEvent = events.find((e) => e.type === 'status_applied');
    const healEvent = events.find((e) => e.type === 'heal');
    const dmgP1 = events.filter((e) => e.target === 'p1' && e.type === 'damage').reduce((acc, e) => acc + (e.value || 0), 0);
    const dmgP2 = events.filter((e) => e.target === 'p2' && e.type === 'damage').reduce((acc, e) => acc + (e.value || 0), 0);

    const c1Name = events.find((e) => e.actor === 'p1' && e.type === 'card_reveal')?.text?.replace('Revelou ', '') || 'Golpe';
    const c2Name = events.find((e) => e.actor === 'p2' && e.type === 'card_reveal')?.text?.replace('Revelou ', '') || 'Golpe';

    let narrativeText = '';
    const seed = (rngSeed + turnNumber * 37) >>> 0;

    if (critEvent) {
      const isP1 = critEvent.actor === 'p1';
      const attacker = isP1 ? p1Name : p2Name;
      const target = isP1 ? p2Name : p1Name;
      const card = isP1 ? c1Name : c2Name;
      const damage = isP1 ? dmgP2 : dmgP1;
      const tpl = this.CRIT_TEMPLATES[seed % this.CRIT_TEMPLATES.length];
      narrativeText = tpl
        .replace('{attacker}', attacker)
        .replace('{target}', target)
        .replace('{card}', card)
        .replace('{damage}', String(damage || 20));
    } else if (dodgeEvent) {
      const isP1Dodge = dodgeEvent.actor === 'p1';
      const target = isP1Dodge ? p1Name : p2Name;
      const attacker = isP1Dodge ? p2Name : p1Name;
      const card = isP1Dodge ? c2Name : c1Name;
      const tpl = this.DODGE_TEMPLATES[seed % this.DODGE_TEMPLATES.length];
      narrativeText = tpl
        .replace('{attacker}', attacker)
        .replace('{target}', target)
        .replace('{card}', card);
    } else if (statusEvent) {
      const isP1 = statusEvent.actor === 'p1';
      const attacker = isP1 ? p1Name : p2Name;
      const target = isP1 ? p2Name : p1Name;
      const card = isP1 ? c1Name : c2Name;
      const damage = isP1 ? dmgP2 : dmgP1;
      const statusName = statusEvent.text?.split('com ')?.[1] || 'FAKE NEWS';
      const tpl = this.STATUS_TEMPLATES[seed % this.STATUS_TEMPLATES.length];
      narrativeText = tpl
        .replace('{attacker}', attacker)
        .replace('{target}', target)
        .replace('{card}', card)
        .replace('{damage}', String(damage))
        .replace('{status}', statusName);
    } else if (healEvent) {
      const isP1 = healEvent.actor === 'p1';
      const actor = isP1 ? p1Name : p2Name;
      const card = isP1 ? c1Name : c2Name;
      const heal = healEvent.value || 15;
      const tpl = this.HEAL_TEMPLATES[seed % this.HEAL_TEMPLATES.length];
      narrativeText = tpl
        .replace('{actor}', actor)
        .replace('{card}', card)
        .replace('{heal}', String(heal));
    } else if (dmgP1 > 0 && dmgP2 > 0) {
      const tpl = this.MUTUAL_ATTACK_TEMPLATES[seed % this.MUTUAL_ATTACK_TEMPLATES.length];
      narrativeText = tpl
        .replace('{p1}', p1Name)
        .replace('{p2}', p2Name)
        .replace('{c1}', c1Name)
        .replace('{c2}', c2Name)
        .replace('{d1}', String(dmgP2))
        .replace('{d2}', String(dmgP1));
    } else {
      narrativeText = `${p1Name} usou ${c1Name} (${dmgP2} dano) e ${p2Name} respondeu com ${c2Name} (${dmgP1} dano). Disputa ferrenha na votação!`;
    }

    // Linha do Histórico (1 linha concisa para o bloco "COMO CHEGAMOS ATÉ AQUI")
    let historyLine = '';
    if (critEvent) {
      const attacker = critEvent.actor === 'p1' ? p1Name : p2Name;
      historyLine = `T${turnNumber}  ${attacker} acertou CRÍTICO com ${critEvent.actor === 'p1' ? c1Name : c2Name}! (−${critEvent.actor === 'p1' ? dmgP2 : dmgP1})`;
    } else if (dodgeEvent) {
      const dodger = dodgeEvent.actor === 'p1' ? p1Name : p2Name;
      historyLine = `T${turnNumber}  ${dodger} esquivou-se com foro privilegiado!`;
    } else if (dmgP1 > dmgP2 && dmgP1 > 0) {
      historyLine = `T${turnNumber}  ${p2Name} passou o trator com ${c2Name} (−${dmgP1})`;
    } else if (dmgP2 > 0) {
      historyLine = `T${turnNumber}  ${p1Name} atacou firme com ${c1Name} (−${dmgP2})`;
    } else {
      historyLine = `T${turnNumber}  Trocação equilibrada de discursos e emendas`;
    }

    // Comentarista só fala em momentos de destaque!
    let commentatorLine: string | null = null;
    const isHighlight =
      combatResult.winner !== 'none' ||
      critEvent !== undefined ||
      dodgeEvent !== undefined ||
      p1.currentHp / p1.maxHp < 0.3 ||
      p2.currentHp / p2.maxHp < 0.3 ||
      p1.popularity >= 80 ||
      p2.popularity >= 80 ||
      turnNumber === 1;

    if (isHighlight) {
      const cIndex = (seed * 3) % this.COMMENTATOR_LINES.length;
      commentatorLine = this.COMMENTATOR_LINES[cIndex];
    }

    return {
      narrativeText,
      commentatorLine,
      historyLine,
    };
  }

  /**
   * Gera a mensagem final da batalha exclusiva quando status === 'finished'
   */
  public static generateFinalBattleMessage(params: {
    battle: RpgBattle;
    p1: RpgBattleParticipant;
    p2: RpgBattleParticipant;
    p1CharTitle?: string;
    p2CharTitle?: string;
  }): string {
    const { battle, p1, p2, p1CharTitle, p2CharTitle } = params;
    const p1Name = this.cleanFighterName(p1.name, p1.isBot);
    const p2Name = this.cleanFighterName(p2.name, p2.isBot);

    const winnerIsP1 = battle.winnerPlayerId === p1.playerId;
    const winnerIsP2 = battle.winnerPlayerId === p2.playerId;
    const isDraw = !winnerIsP1 && !winnerIsP2;
    const winnerName = winnerIsP1 ? p1Name : winnerIsP2 ? p2Name : null;
    const loserName = winnerIsP1 ? p2Name : winnerIsP2 ? p1Name : null;
    const winnerPart = winnerIsP1 ? p1 : p2;
    const loserPart = winnerIsP1 ? p2 : p1;

    const lines: string[] = [];
    lines.push('🏛️ *ZAPTROLL RPG — SESSÃO EXTRAORDINÁRIA ENCERRADA* 🥊');
    lines.push(`⚔️ *${p1Name}*  _VS_  *${p2Name}*`);
    lines.push(`📍 *${battle.arena.toUpperCase()}* • *Desfecho Final no Turno ${battle.currentTurn}*`);
    lines.push('');

    if (winnerName && loserName) {
      lines.push(`🏆 *GRANDE VENCEDOR:* 👑 *${winnerName.toUpperCase()}*`);
      lines.push('');
      lines.push('📜 *COMO FOI O DESFECHO DA VITÓRIA:*');

      let reason = '';
      if (loserPart.currentHp <= 0) {
        reason = `${winnerName} desferiu o golpe de misericórdia e zerou completamente os pontos de vida de ${loserName}! Sem base parlamentar e sem fôlego político, ${loserName} teve o mandato sumariamente cassado no plenário!`;
      } else if (winnerPart.popularity >= 80) {
        reason = `${winnerName} conquistou a maioria esmagadora do Ibope e da opinião pública popular (${winnerPart.popularity}%). Pela regra de aclamação regimental, a vitória foi decretada por nocaute político!`;
      } else {
        reason = `Ao término dos turnos regimentais, ${winnerName} sustentou maior volume de saúde política (${winnerPart.currentHp} HP) e ampla vantagem estratégica sobre ${loserName}. Mandato garantido nas urnas!`;
      }

      lines.push(reason);
      lines.push('');
    } else {
      lines.push('⚖️ *RESULTADO:* *EMPATE REGIMENTAL!*');
      lines.push('📜 A disputa foi tão acirrada e o plenário ficou tão dividido que a Mesa Diretora declarou empate por falta de quórum.');
      lines.push('');
    }

    lines.push('📊 *PLACAR FINAL:*');
    lines.push(`👔 *${p1Name}* (${p1CharTitle || 'Candidato'})`);
    lines.push(`❤️ ${this.renderHpBar(p1.currentHp, p1.maxHp)} | 🔥 Ibope: ${p1.popularity}%`);
    lines.push(`📑 *${p2Name}* (${p2CharTitle || 'Candidato'})`);
    lines.push(`❤️ ${this.renderHpBar(p2.currentHp, p2.maxHp)} | 🔥 Ibope: ${p2.popularity}%`);
    lines.push('');

    lines.push('💰 *PREMIAÇÃO REGIMENTAL COMPUTADA:*');
    lines.push('🎖️ +120 XP Eleitoral para o vencedor (+40 XP de consolação)');
    lines.push('🌟 +15 Prestígio Político no ranking oficial');
    lines.push('💵 R$ 850,00 de Verba Parlamentar creditada no cofre');
    lines.push('');
    lines.push('🏛️ *O mandato foi homologado e a arena está liberada para o próximo duelo!*');

    return lines.join('\n');
  }
}
