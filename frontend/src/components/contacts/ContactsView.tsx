import React, { useState, useEffect } from 'react';
import { UserCheck, Search, MessageSquare, Phone } from 'lucide-react';
import api from '../../services/api.js';
import { Contact, WhatsAppConnection } from '../../types/index.js';
import { MemeAvatar } from '../memes/MemeAvatar.js';

interface ContactsViewProps {
  connection: WhatsAppConnection | null;
  onSelectContact?: (contact: Contact) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ connection, onSelectContact }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connection) return;
    setLoading(true);
    api
      .get(`/contacts/connection/${connection.id}?search=${encodeURIComponent(search)}`)
      .then((res) => setContacts(res.data.contacts))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [connection?.id, search]);

  if (!connection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400 bg-[#0d1117]">
        <UserCheck className="w-12 h-12 text-gray-600 mb-2" />
        <h3 className="text-sm font-bold text-gray-200 font-mono">Nenhuma Conexão Selecionada</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-xs font-mono">
          Vá para a aba Conexões e selecione uma sessão ativa para sincronizar seus contatos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Search Header */}
      <div className="lab-glass sticky top-0 z-10 px-4 py-3 border-b border-[#2a3346]">
        <h1 className="text-base font-bold font-mono text-white mb-2 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#39ff14]" />
          <span>Contatos do Laboratório ({contacts.length})</span>
        </h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar contato por nome ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#161922] border border-[#2a3346] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#39ff14] transition font-mono"
          />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-16 md:pb-3">
        {loading ? (
          <div className="text-center py-8 text-xs text-gray-400 font-mono">
            Carregando contatos...
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-xs text-gray-500 font-mono">
            Nenhum contato sincronizado para esta sessão.
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => onSelectContact?.(contact)}
              className="bg-[#161922] p-3 rounded-2xl border border-[#2a3346] hover:border-[#39ff14]/50 flex items-center justify-between cursor-pointer transition shadow-sm hover:scale-[1.01]"
            >
              <div className="flex items-center gap-3">
                <MemeAvatar
                  seed={contact.jid || contact.name || 'contact'}
                  name={contact.name}
                  src={contact.profilePicUrl}
                  size="md"
                />
                <div>
                  <h4 className="text-xs font-bold text-white font-sans">
                    {contact.name || contact.notifyName || contact.phoneNumber || contact.jid}
                  </h4>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {contact.phoneNumber ? `+${contact.phoneNumber}` : contact.jid}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="p-2 text-[#39ff14] hover:bg-[#1a202c] rounded-xl transition border border-transparent hover:border-[#2a3346]"
                title="Iniciar conversa"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
