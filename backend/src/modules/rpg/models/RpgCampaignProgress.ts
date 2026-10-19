import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../database/index.js';

export interface RpgCampaignProgressAttributes {
  id: string;
  playerId: string;
  currentChapter: number; // 1 a 7
  completedChapters: number[];
  reputationScore: number; // -100 a +100
  choicesMade: Record<string, number | string>;
}

export class RpgCampaignProgress extends Model<RpgCampaignProgressAttributes, Partial<RpgCampaignProgressAttributes>> implements RpgCampaignProgressAttributes {
  declare id: string;
  declare playerId: string;
  declare currentChapter: number;
  declare completedChapters: number[];
  declare reputationScore: number;
  declare choicesMade: Record<string, number | string>;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RpgCampaignProgress.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    playerId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    currentChapter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    completedChapters: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    reputationScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    choicesMade: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    tableName: 'rpg_campaign_progress',
    timestamps: true,
  }
);

export interface RpgConfigAttributes {
  key: string;
  value: string;
  description?: string | null;
}

export class RpgConfig extends Model<RpgConfigAttributes, Partial<RpgConfigAttributes>> implements RpgConfigAttributes {
  declare key: string;
  declare value: string;
  declare description: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  public static async getBool(key: string, defaultValue = true): Promise<boolean> {
    const record = await this.findByPk(key);
    if (!record) return defaultValue;
    return record.value === 'true' || record.value === '1';
  }

  public static async getNumber(key: string, defaultValue = 0): Promise<number> {
    const record = await this.findByPk(key);
    if (!record) return defaultValue;
    const num = parseFloat(record.value);
    return isNaN(num) ? defaultValue : num;
  }
}

RpgConfig.init(
  {
    key: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'rpg_config',
    timestamps: true,
  }
);
