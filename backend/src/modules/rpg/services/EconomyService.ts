import { RpgPlayer, RpgItem, RpgInventory } from '../models/index.js';
import { sequelize } from '../../../database/index.js';

export class EconomyService {
  /**
   * Obtém título político baseado no nível e prestígio
   */
  public static getTitleByLevel(level: number, prestige: number): string {
    if (prestige > 0) {
      return `🏛️ Patriarca da República (P${prestige})`;
    }
    if (level >= 30) return '👑 Presidente da República';
    if (level >= 20) return '🎖️ Senador Vitalício';
    if (level >= 15) return '💼 Deputado do Centrão';
    if (level >= 10) return '📢 Vereador de Oposição';
    if (level >= 5) return '📋 Assessor Parlamentar';
    return '📎 Estagiário de Gabinete';
  }

  /**
   * Retorna os dados formatados do perfil do jogador
   */
  public static async getProfile(phone: string, userName?: string): Promise<{ player: RpgPlayer; formatted: string }> {
    let player = await RpgPlayer.findOne({ where: { whatsappPhone: phone } });
    if (!player) {
      player = await RpgPlayer.create({
        whatsappPhone: phone,
        name: userName || 'Candidato',
      });
    }

    const title = this.getTitleByLevel(player.level, player.prestige);
    const totalBattles = player.victories + player.defeats + player.draws;
    const winRate = totalBattles > 0 ? Math.round((player.victories / totalBattles) * 100) : 0;

    const formatted = [
      `👤 *PERFIL POLÍTICO: ${player.name}*`,
      `🏷️ *Cargo:* ${title}`,
      `⭐ *Nível:* ${player.level} (${player.xp} XP)`,
      `💰 *Verba de Gabinete:* ${player.coins} R$`,
      `🏆 *Pontuação ELO:* ${player.elo} | *Prestígio:* ${player.prestige}`,
      `⚔️ *Batalhas:* ${totalBattles} (${player.victories}V / ${player.defeats}D — ${winRate}% Vitórias)`,
      `🔥 *Sequência:* ${player.winStreak} vitórias seguidas`,
      `🛡️ *Bônus Equip:* +${player.bonusHp} HP | +${player.bonusAtk} ATK | +${player.bonusDef} DEF`,
      '',
      `💡 _Dica: Digite /inventario para ver seus itens ou /loja para adquirir novos equipamentos._`,
    ].join('\n');

    return { player, formatted };
  }

  /**
   * Coleta a recompensa diária de verba de gabinete (/diaria)
   */
  public static async claimDaily(phone: string, userName?: string): Promise<string> {
    let player = await RpgPlayer.findOne({ where: { whatsappPhone: phone } });
    if (!player) {
      player = await RpgPlayer.create({
        whatsappPhone: phone,
        name: userName || 'Candidato',
      });
    }

    const now = new Date();
    const lastClaim = player.lastDailyRewardAt ? new Date(player.lastDailyRewardAt) : null;

    if (lastClaim) {
      const diffMs = now.getTime() - lastClaim.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 24) {
        const remainingHours = Math.ceil(24 - diffHours);
        return `⏳ Você já recolheu sua verba parlamentar hoje! Volte em aproximadamente ${remainingHours}h.`;
      }

      // Se passou entre 24h e 48h, mantém a sequência diária; se > 48h, reseta
      if (diffHours <= 48) {
        player.dailyStreak += 1;
      } else {
        player.dailyStreak = 1;
      }
    } else {
      player.dailyStreak = 1;
    }

    // Base: 100 R$ e 50 XP + bônus de streak
    const streakBonus = Math.min(player.dailyStreak * 15, 150);
    const totalCoins = 100 + streakBonus;
    const totalXp = 50 + player.dailyStreak * 5;

    player.coins += totalCoins;
    player.xp += totalXp;
    player.lastDailyRewardAt = now;
    await player.save();

    return [
      `💼 *VERBA DIÁRIA DE GABINETE LIBERADA!* 🏛️`,
      '',
      `💰 *Valor recebido:* +${totalCoins} R$`,
      `⭐ *Experiência:* +${totalXp} XP`,
      `🔥 *Sequência de presença:* ${player.dailyStreak} dia(s) consecutivo(s)!`,
      `💵 *Saldo atual:* ${player.coins} R$`,
      '',
      `_A verba foi depositada sem retenção na fonte. Bom mandato!_`,
    ].join('\n');
  }

  /**
   * Catálogo de itens da loja (/loja)
   */
  public static async getStoreCatalog(): Promise<string> {
    const items = await RpgItem.findAll({ order: [['price', 'ASC']] });

    if (!items.length) {
      return '🏪 A Loja de Brasília está fechada para recesso parlamentar no momento.';
    }

    const lines = [
      '🏪 *LOJA DO CONGRESSO & MERCADO NEGRO* 🏛️',
      'Adquira equipamentos para melhorar seus atributos ou consumíveis de combate.',
      '',
    ];

    for (const item of items) {
      const buffs = [];
      if (item.bonusHp > 0) buffs.push(`+${item.bonusHp} HP`);
      if (item.bonusAtk > 0) buffs.push(`+${item.bonusAtk} ATK`);
      if (item.bonusDef > 0) buffs.push(`+${item.bonusDef} DEF`);
      const buffStr = buffs.length > 0 ? ` [${buffs.join(', ')}]` : '';

      lines.push(`${item.emoji} *${item.name}* (ID: \`${item.id}\`)`);
      lines.push(`   💰 Preço: *${item.price} R$* | Tipo: ${item.type}${buffStr}`);
      lines.push(`   📝 ${item.description}`);
      lines.push('');
    }

    lines.push('👉 Para comprar, digite: */comprar <id>* (Ex: `/comprar microfone_ouro`)');
    return lines.join('\n');
  }

  /**
   * Compra um item da loja
   */
  public static async buyItem(phone: string, itemId: string): Promise<string> {
    const item = await RpgItem.findByPk(itemId);
    if (!item) {
      return `❌ Item com ID \`${itemId}\` não foi encontrado na loja.`;
    }

    const player = await RpgPlayer.findOne({ where: { whatsappPhone: phone } });
    if (!player) {
      return '❌ Perfil de jogador não encontrado. Digite /perfil primeiro.';
    }

    if (player.coins < item.price) {
      return `❌ Saldo insuficiente! Você possui ${player.coins} R$, mas o item custa ${item.price} R$.`;
    }

    const t = await sequelize.transaction();
    try {
      player.coins -= item.price;
      await player.save({ transaction: t });

      const existingInv = await RpgInventory.findOne({
        where: { playerId: player.id, itemId: item.id },
        transaction: t,
      });

      if (existingInv) {
        existingInv.quantity += 1;
        await existingInv.save({ transaction: t });
      } else {
        await RpgInventory.create(
          {
            playerId: player.id,
            itemId: item.id,
            quantity: 1,
            equipped: false,
          },
          { transaction: t }
        );
      }

      await t.commit();
      return `✅ *COMPRA REALIZADA COM SUCESSO!* 🛍️\nVocê comprou *${item.name}* ${item.emoji} por ${item.price} R$.\nNovo saldo: ${player.coins} R$.\nDigite */inventario* para ver seus pertences.`;
    } catch (err: any) {
      await t.rollback();
      return `❌ Falha ao processar compra: ${err.message}`;
    }
  }

  /**
   * Lista o inventário do jogador (/inventario)
   */
  public static async getInventory(phone: string): Promise<string> {
    const player = await RpgPlayer.findOne({
      where: { whatsappPhone: phone },
      include: [{ model: RpgInventory, as: 'inventory' }],
    });

    if (!player) {
      return '❌ Perfil não encontrado. Digite /perfil para começar.';
    }

    const inventory = (player.get('inventory') as RpgInventory[]) || [];
    if (!inventory.length) {
      return `🎒 *SEU INVENTÁRIO ESTÁ VAZIO!*\nSaldo disponível: *${player.coins} R$*.\nVisite a */loja* para adquirir equipamentos!`;
    }

    const lines = [
      `🎒 *INVENTÁRIO PARLAMENTAR DE ${player.name}*`,
      `💰 *Saldo:* ${player.coins} R$`,
      '',
    ];

    for (const entry of inventory) {
      const item = await RpgItem.findByPk(entry.itemId);
      if (!item) continue;

      const equippedTag = entry.equipped ? ' 🛡️ *(EQUIPADO)*' : '';
      const qtyStr = entry.quantity > 1 ? ` (x${entry.quantity})` : '';

      lines.push(`${item.emoji} *${item.name}*${qtyStr}${equippedTag}`);
      lines.push(`   ID: \`${item.id}\` | Tipo: ${item.type}`);
      lines.push(`   📝 ${item.description}`);
      lines.push('');
    }

    lines.push('👉 Para equipar ou usar um item, digite: */usar <id>* (Ex: `/usar microfone_ouro`)');
    return lines.join('\n');
  }

  /**
   * Equipa ou consome um item do inventário (/usar <id>)
   */
  public static async useItem(phone: string, itemId: string): Promise<string> {
    const player = await RpgPlayer.findOne({ where: { whatsappPhone: phone } });
    if (!player) return '❌ Perfil não encontrado.';

    const inv = await RpgInventory.findOne({
      where: { playerId: player.id, itemId },
    });

    if (!inv || inv.quantity <= 0) {
      return `❌ Você não possui o item \`${itemId}\` no seu inventário.`;
    }

    const item = await RpgItem.findByPk(itemId);
    if (!item) return '❌ Item desconhecido.';

    // Se for consumível
    if (item.type === 'consumivel') {
      inv.quantity -= 1;
      if (inv.quantity <= 0) {
        await inv.destroy();
      } else {
        await inv.save();
      }

      let effectMsg = 'Efeito aplicado com sucesso!';
      if (item.consumableEffect?.heal) {
        effectMsg = `Cura de +${item.consumableEffect.heal} HP aplicada para sua próxima batalha!`;
      }

      return `🧪 *ITEM CONSUMIDO!* Você usou *${item.name}* ${item.emoji}.\n${effectMsg}`;
    }

    // Se for equipamento (arma, roupa, acessorio, amuleto)
    const t = await sequelize.transaction();
    try {
      // Buscar todos os itens do inventário para desequipar outro do mesmo tipo se houver
      const allPlayerInv = await RpgInventory.findAll({
        where: { playerId: player.id },
        transaction: t,
      });

      for (const otherInv of allPlayerInv) {
        if (otherInv.equipped && otherInv.itemId !== item.id) {
          const otherItem = await RpgItem.findByPk(otherInv.itemId, { transaction: t });
          if (otherItem && otherItem.type === item.type) {
            otherInv.equipped = false;
            await otherInv.save({ transaction: t });
          }
        }
      }

      // Alternar estado de equipado
      inv.equipped = !inv.equipped;
      await inv.save({ transaction: t });

      // Recalcular bônus do jogador
      let totalBonusHp = 0;
      let totalBonusAtk = 0;
      let totalBonusDef = 0;

      for (const entry of allPlayerInv) {
        const isCurrentEquipped = entry.id === inv.id ? inv.equipped : entry.equipped;
        if (isCurrentEquipped) {
          const it = await RpgItem.findByPk(entry.itemId, { transaction: t });
          if (it) {
            totalBonusHp += it.bonusHp;
            totalBonusAtk += it.bonusAtk;
            totalBonusDef += it.bonusDef;
          }
        }
      }

      player.bonusHp = totalBonusHp;
      player.bonusAtk = totalBonusAtk;
      player.bonusDef = totalBonusDef;
      await player.save({ transaction: t });

      await t.commit();

      const actionText = inv.equipped ? 'equipado' : 'desequipado';
      return `🛡️ *EQUIPAMENTO:* *${item.name}* ${item.emoji} foi ${actionText}!\nNovos atributos: +${player.bonusHp} HP, +${player.bonusAtk} ATK, +${player.bonusDef} DEF.`;
    } catch (err: any) {
      await t.rollback();
      return `❌ Erro ao equipar item: ${err.message}`;
    }
  }

  /**
   * Ranking / Placar dos líderes (/ranking)
   */
  public static async getLeaderboard(limit = 7): Promise<string> {
    const topPlayers = await RpgPlayer.findAll({
      order: [
        ['elo', 'DESC'],
        ['level', 'DESC'],
      ],
      limit,
    });

    if (!topPlayers.length) {
      return '🏆 Ainda não há registros suficientes no ranking parlamentar.';
    }

    const lines = [
      '🏆 *RANKING DOS PARLAMENTARES MAIS PODEROSOS* 🏛️',
      'Os melhores combatentes políticos da arena:',
      '',
    ];

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣'];

    topPlayers.forEach((p, idx) => {
      const medal = medals[idx] || '🏅';
      lines.push(`${medal} *${p.name}* — ${p.elo} ELO (Nv. ${p.level})`);
      lines.push(`   ⚔️ ${p.victories} Vitórias | 🔥 Sequência: ${p.winStreak}`);
    });

    lines.push('');
    lines.push('👉 Dispute duelos (/duelo @alguem) para subir no ranking!');
    return lines.join('\n');
  }
}
