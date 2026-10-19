import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Swords,
  Users,
  Trophy,
  Coins,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Flame,
  Settings,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface CharacterAdmin {
  id: string;
  name: string;
  characterClass: string;
  affinity: string;
  avatarEmoji: string;
  active: boolean;
  passiveName?: string;
}

interface ConfigItem {
  key: string;
  value: string;
  description?: string;
}

interface AdminOverviewData {
  stats: {
    totalPlayers: number;
    activeBattlesCount: number;
    totalBattlesCount: number;
    totalCoinsInCirculation: number;
  };
  characters: CharacterAdmin[];
  configs: ConfigItem[];
  recentBattles: any[];
}

interface RpgAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RpgAdminModal: React.FC<RpgAdminModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'configs' | 'battles'>('overview');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/rpg/admin/overview');
      setData(res.data);
    } catch (err: any) {
      console.error('Erro ao carregar dados administrativos do RPG:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen]);

  const handleToggleCharacter = async (charId: string) => {
    try {
      setUpdatingKey(charId);
      const res = await axios.post(`/api/rpg/admin/personagens/${charId}/toggle`);
      if (res.data.success && data) {
        setData({
          ...data,
          characters: data.characters.map((c) =>
            c.id === charId ? { ...c, active: res.data.active } : c
          ),
        });
      }
    } catch (err: any) {
      alert('Erro ao alterar status do personagem.');
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleToggleConfig = async (key: string, currentValue: string) => {
    try {
      setUpdatingKey(key);
      const nextValue = currentValue === 'true' ? 'false' : 'true';
      const res = await axios.put(`/api/rpg/admin/configs/${key}`, { value: nextValue });
      if (res.data.success && data) {
        setData({
          ...data,
          configs: data.configs.map((cfg) =>
            cfg.key === key ? { ...cfg, value: nextValue } : cfg
          ),
        });
      }
    } catch (err: any) {
      alert('Erro ao atualizar configuração.');
    } finally {
      setUpdatingKey(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c1017] border border-emerald-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#111622] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-wide uppercase text-emerald-400">
                Painel Administrativo // Zaptroll RPG
              </h2>
              <p className="text-xs text-gray-400">Controle de Arquétipos, Regras, Apostas e Telemetria</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAdminData}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-white/10 bg-[#0e131d] px-6 gap-2">
          {[
            { id: 'overview', label: 'Visão Geral', icon: Trophy },
            { id: 'characters', label: 'Personagens & Kill-Switch', icon: Users },
            { id: 'configs', label: 'Feature Flags', icon: Settings },
            { id: 'battles', label: 'Lutas Recentes', icon: Swords },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition border-b-2 ${
                  isActive
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-16 text-emerald-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-3" />
              <p className="text-xs font-mono">Carregando telemetria política...</p>
            </div>
          ) : data ? (
            <>
              {/* TAB 1: VISÃO GERAL */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Grid de KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center justify-between text-gray-400 mb-2">
                        <span className="text-xs font-mono">Parlamentares</span>
                        <Users className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-black text-white">{data.stats.totalPlayers}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center justify-between text-gray-400 mb-2">
                        <span className="text-xs font-mono">Lutas ao Vivo</span>
                        <Flame className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="text-2xl font-black text-emerald-400">{data.stats.activeBattlesCount}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center justify-between text-gray-400 mb-2">
                        <span className="text-xs font-mono">Total de Debates</span>
                        <Swords className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="text-2xl font-black text-white">{data.stats.totalBattlesCount}</div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center justify-between text-gray-400 mb-2">
                        <span className="text-xs font-mono">Verba Circulante</span>
                        <Coins className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="text-2xl font-black text-yellow-400">{data.stats.totalCoinsInCirculation} R$</div>
                    </div>
                  </div>

                  {/* Resumo Rápido */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-teal-950/30 border border-emerald-500/20">
                    <h3 className="font-bold text-sm text-emerald-300 flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      Status do Ecossistema RPG
                    </h3>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      O motor puro determinístico está operando com semente Mulberry32. Os comandos de WhatsApp estão
                      escutando mensagens no <code>ZapoEventHandler</code> e a arena 2.5D está respondendo via Socket.IO
                      em <code>/rpg/batalha/:battleId</code>.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: PERSONAGENS & KILL-SWITCH */}
              {activeTab === 'characters' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Catálogo de Arquétipos Políticos</h3>
                      <p className="text-xs text-gray-400">
                        Desative temporariamente um personagem caso necessite de balanceamento ou intervenção legal.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.characters.map((char) => (
                      <div
                        key={char.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                          char.active
                            ? 'bg-white/[0.03] border-white/10 hover:border-emerald-500/40'
                            : 'bg-red-950/20 border-red-500/30 opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-3xl p-2 rounded-xl bg-black/40 border border-white/10">
                            {char.avatarEmoji}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-white">{char.name}</h4>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-emerald-300 uppercase">
                                {char.affinity}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400">
                              Classe: <span className="capitalize">{char.characterClass}</span> | Passiva: {char.passiveName}
                            </p>
                          </div>
                        </div>

                        <button
                          disabled={updatingKey === char.id}
                          onClick={() => handleToggleCharacter(char.id)}
                          className={`p-2 rounded-lg transition flex items-center gap-1.5 text-xs font-bold ${
                            char.active
                              ? 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/40'
                              : 'bg-red-950/80 text-red-300 hover:bg-red-900 border border-red-500/40'
                          }`}
                        >
                          {char.active ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-emerald-400" /> Ativo
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-red-400" /> Inativo
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: FEATURE FLAGS */}
              {activeTab === 'configs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Chaves & Feature Flags de Sistema</h3>
                      <p className="text-xs text-gray-400">
                        Ative ou desative módulos de jogo globalmente sem necessidade de rebuild.
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-white/5 rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                    {data.configs.map((cfg) => {
                      const isBoolean = cfg.value === 'true' || cfg.value === 'false';
                      const isEnabled = cfg.value === 'true';

                      return (
                        <div key={cfg.key} className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                          <div>
                            <div className="font-mono text-xs font-bold text-emerald-400">{cfg.key}</div>
                            {cfg.description && <p className="text-xs text-gray-400 mt-0.5">{cfg.description}</p>}
                          </div>

                          <div>
                            {isBoolean ? (
                              <button
                                disabled={updatingKey === cfg.key}
                                onClick={() => handleToggleConfig(cfg.key, cfg.value)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition border ${
                                  isEnabled
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                    : 'bg-red-950/80 text-red-300 border-red-500/40'
                                }`}
                              >
                                {isEnabled ? 'Ativado' : 'Desativado'}
                              </button>
                            ) : (
                              <span className="font-mono text-xs px-2.5 py-1 rounded bg-black/60 border border-white/10 text-gray-300">
                                {cfg.value}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: LUTAS RECENTES */}
              {activeTab === 'battles' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Últimos Debates Registrados</h3>
                  <div className="divide-y divide-white/5 rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden">
                    {data.recentBattles.map((b) => (
                      <div key={b.id} className="p-4 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white uppercase tracking-wider font-mono">
                              MODO {b.mode}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-emerald-300">
                              Turno {b.currentTurn} / {b.maxTurns}
                            </span>
                            <span className="text-gray-500">ID: {b.id.slice(0, 8)}</span>
                          </div>
                          <div className="text-gray-400">
                            Participantes:{' '}
                            {b.participants?.map((p: any) => p.name).join(' vs ') || 'Desconhecidos'}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-1 rounded font-bold font-mono text-[11px] ${
                            b.status === 'finished'
                              ? 'bg-purple-950 text-purple-300'
                              : 'bg-emerald-950 text-emerald-300 animate-pulse'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
