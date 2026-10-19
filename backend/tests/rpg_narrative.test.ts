import { describe, it, expect } from 'vitest';
import { BattleNarratorService } from '../src/modules/rpg/services/BattleNarratorService.js';
import { MessageSyncService } from '../src/modules/rpg/services/MessageSyncService.js';

describe('Zaptroll RPG — Battle Narrative & Message Formatting', () => {
  it('cleans bot names cleanly without repeating (Bot)', () => {
    expect(BattleNarratorService.cleanFighterName('Dona Reforma (Bot)', true)).toBe('Dona Reforma 🤖');
    expect(BattleNarratorService.cleanFighterName('Lobista Sombrio (CHEFE)', true)).toBe('Lobista Sombrio 💀');
    expect(BattleNarratorService.cleanFighterName('Yran', false)).toBe('Yran');
  });

  it('renders dynamic HP bars according to health percentage rules', () => {
    // > 60%: Verde
    const highHp = BattleNarratorService.renderHpBar(80, 100);
    expect(highHp).toContain('🟩');
    expect(highHp).not.toContain('🟥');

    // 30% - 60%: Amarelo
    const midHp = BattleNarratorService.renderHpBar(50, 100);
    expect(midHp).toContain('🟨');
    expect(midHp).not.toContain('🟩');
    expect(midHp).not.toContain('🟥');

    // < 30%: Vermelho
    const lowHp = BattleNarratorService.renderHpBar(25, 100);
    expect(lowHp).toContain('🟥');
    expect(lowHp).not.toContain('🟩');
    expect(lowHp).not.toContain('🟨');
  });

  it('generates sports-style narrative deterministically with seed', () => {
    const mockP1: any = { id: 'p1', name: 'Yran', isBot: false };
    const mockP2: any = { id: 'p2', name: 'Dona Reforma (Bot)', isBot: true };

    const mockCombatResult: any = {
      winner: 'none',
      events: [
        { type: 'card_reveal', actor: 'p1', text: 'Revelou Soco Demagógico' },
        { type: 'card_reveal', actor: 'p2', text: 'Revelou Burocracia' },
        { type: 'damage', actor: 'p1', target: 'p2', value: 18 },
        { type: 'damage', actor: 'p2', target: 'p1', value: 20 },
      ],
    };

    const res1 = BattleNarratorService.generateTurnNarrative({
      turnNumber: 5,
      rngSeed: 12345,
      p1: mockP1,
      p2: mockP2,
      combatResult: mockCombatResult,
    });

    const res2 = BattleNarratorService.generateTurnNarrative({
      turnNumber: 5,
      rngSeed: 12345,
      p1: mockP1,
      p2: mockP2,
      combatResult: mockCombatResult,
    });

    // Replay com o mesmo seed gera a mesma narração
    expect(res1.narrativeText).toBe(res2.narrativeText);
    expect(res1.historyLine).toBe(res2.historyLine);
    expect(res1.narrativeText.length).toBeGreaterThan(20);
    expect(res1.historyLine).toContain('T5');
  });

  it('generates exclusive final message on finished status with winner and victory reason', () => {
    const mockBattle: any = {
      id: 'b1',
      status: 'finished',
      arena: 'ring_brasilia',
      currentTurn: 12,
      winnerPlayerId: 'player_yran',
    };

    const mockP1: any = {
      playerId: 'player_yran',
      name: 'Yran',
      currentHp: 42,
      maxHp: 100,
      popularity: 65,
      isBot: false,
    };

    const mockP2: any = {
      playerId: null,
      name: 'Dona Reforma (Bot)',
      currentHp: 0,
      maxHp: 110,
      popularity: 20,
      isBot: true,
    };

    const finalMsg = BattleNarratorService.generateFinalBattleMessage({
      battle: mockBattle,
      p1: mockP1,
      p2: mockP2,
      p1CharTitle: 'O Mestre dos Palanques',
      p2CharTitle: 'A Czarina das Planilhas',
    });

    expect(finalMsg).toContain('GRANDE VENCEDOR:* 👑 *YRAN*');
    expect(finalMsg).toContain('COMO FOI O DESFECHO DA VITÓRIA:');
    expect(finalMsg).toContain('zerou completamente os pontos de vida');
    expect(finalMsg).toContain('PREMIAÇÃO REGIMENTAL COMPUTADA:');
    // Não pode conter instruções de escolha de cartas ou timer
    expect(finalMsg).not.toContain('Tempo para decisão');
    expect(finalMsg).not.toContain('Responda com 1');
  });

  it('keeps battle message length strictly within limits and omits embedded webview url', async () => {
    const mockBattle: any = {
      id: 'b_live',
      status: 'selecting_cards',
      arena: 'ring_brasilia',
      currentTurn: 3,
      maxTurns: 20,
    };

    const mockP1: any = {
      id: 'p1',
      name: 'Yran',
      currentHp: 75,
      maxHp: 100,
      currentEnergy: 5,
      popularity: 45,
      isBot: false,
      cardLocked: true,
    };

    const mockP2: any = {
      id: 'p2',
      name: 'Dona Reforma (Bot)',
      currentHp: 65,
      maxHp: 110,
      currentEnergy: 4,
      popularity: 40,
      isBot: true,
      cardLocked: false,
    };

    const formatted = await MessageSyncService.formatBattleMessage(mockBattle, mockP1, mockP2, {
      turnNarrative: 'Trocação feroz de acusações entre os dois lutadores!',
      commentatorLine: '🗣️ Comentarista: "O plenário pegou fogo!"',
    });

    // Confere estrutura
    expect(formatted).toContain('ZAPTROLL RPG — ARENA POLÍTICA');
    expect(formatted).toContain('*Yran*  _VS_  *Dona Reforma 🤖*');
    expect(formatted).toContain('✅ Yran travou');
    expect(formatted).toContain('⌛ Dona Reforma 🤖 escolhendo...');
    // Confere que o link de espectador NÃO foi embutido dentro da mensagem principal da batalha
    expect(formatted).not.toContain('/a/');
    // Confere tamanho seguro abaixo de 1.500 caracteres (está em torno de ~500-800)
    expect(formatted.length).toBeLessThan(1200);
  });
});
