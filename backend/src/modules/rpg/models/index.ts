import { RpgPlayer } from './RpgPlayer.js';
import { RpgCharacter } from './RpgCharacter.js';
import { RpgCard } from './RpgCard.js';
import { RpgPlayerCard, RpgPlayerCharacter } from './RpgPlayerCard.js';
import { RpgBattle } from './RpgBattle.js';
import { RpgBattleParticipant } from './RpgBattleParticipant.js';
import { RpgBattleTurn } from './RpgBattleTurn.js';
import { RpgDuelInvite } from './RpgDuelInvite.js';
import { RpgItem, RpgInventory } from './RpgItem.js';
import { RpgCampaignProgress, RpgConfig } from './RpgCampaignProgress.js';
import { RpgAuditLog } from './RpgAuditLog.js';
import { RpgBattleAccessCode } from './RpgBattleAccessCode.js';

// Relacionamentos
RpgPlayer.hasMany(RpgPlayerCharacter, { foreignKey: 'playerId', as: 'characters', onDelete: 'CASCADE' });
RpgPlayerCharacter.belongsTo(RpgPlayer, { foreignKey: 'playerId', as: 'player' });

RpgPlayer.hasMany(RpgPlayerCard, { foreignKey: 'playerId', as: 'cards', onDelete: 'CASCADE' });
RpgPlayerCard.belongsTo(RpgPlayer, { foreignKey: 'playerId', as: 'player' });

RpgPlayer.hasMany(RpgInventory, { foreignKey: 'playerId', as: 'inventory', onDelete: 'CASCADE' });
RpgInventory.belongsTo(RpgPlayer, { foreignKey: 'playerId', as: 'player' });

RpgPlayer.hasOne(RpgCampaignProgress, { foreignKey: 'playerId', as: 'campaign', onDelete: 'CASCADE' });
RpgCampaignProgress.belongsTo(RpgPlayer, { foreignKey: 'playerId', as: 'player' });

RpgBattle.hasMany(RpgBattleParticipant, { foreignKey: 'battleId', as: 'participants', onDelete: 'CASCADE' });
RpgBattleParticipant.belongsTo(RpgBattle, { foreignKey: 'battleId', as: 'battle' });

RpgBattle.hasMany(RpgBattleTurn, { foreignKey: 'battleId', as: 'turns', onDelete: 'CASCADE' });
RpgBattleTurn.belongsTo(RpgBattle, { foreignKey: 'battleId', as: 'battle' });

RpgBattle.hasMany(RpgBattleAccessCode, { foreignKey: 'battleId', as: 'accessCodes', onDelete: 'CASCADE' });
RpgBattleAccessCode.belongsTo(RpgBattle, { foreignKey: 'battleId', as: 'battle' });

export {
  RpgPlayer,
  RpgCharacter,
  RpgCard,
  RpgPlayerCard,
  RpgPlayerCharacter,
  RpgBattle,
  RpgBattleParticipant,
  RpgBattleTurn,
  RpgDuelInvite,
  RpgItem,
  RpgInventory,
  RpgCampaignProgress,
  RpgConfig,
  RpgAuditLog,
  RpgBattleAccessCode,
};
