import React from 'react';
import { MessageSquare, Users, Smartphone, ShieldCheck, UserCheck, Laugh, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';

export type TabType = 'conversations' | 'flows' | 'contacts' | 'groups' | 'connections' | 'memes' | 'admin';

interface BottomTabBarProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentTab,
  onChangeTab,
  unreadCount = 0,
}) => {
  const { isAdmin } = useAuth();

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode; badge?: number }> = [
    {
      id: 'conversations',
      label: 'Conversas',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: unreadCount,
    },
    {
      id: 'flows',
      label: 'Fluxos',
      icon: <Sparkles className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'contacts',
      label: 'Contatos',
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      id: 'groups',
      label: 'Grupos',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'connections',
      label: 'Conexões',
      icon: <Smartphone className="w-4 h-4" />,
    },
  ];

  if (isAdmin) {
    tabs.push({
      id: 'admin',
      label: 'Admin',
      icon: <ShieldCheck className="w-4 h-4" />,
    });
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#131722]/95 backdrop-blur-xl border-t border-[#2a3346] pb-safe shadow-2xl">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 relative transition-all ${
                isActive
                  ? 'text-[#39ff14] filter drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2 bg-[#39ff14] text-black text-[9px] font-mono font-black px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 font-mono ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
