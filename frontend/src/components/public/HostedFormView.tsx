import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, Clock, Send, Lock } from 'lucide-react';
import axios from 'axios';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface FormSchema {
  title: string;
  description?: string;
  fields: FormField[];
  submitButtonText?: string;
}

export const HostedFormView: React.FC<{ publicId: string }> = ({ publicId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(`/api/flows/public/form/${publicId}`);
        setSchema(res.data.schema);
        setExpiresAt(res.data.expiresAt);
        // Pre-fill initial state
        const initial: Record<string, any> = {};
        if (res.data.schema?.fields) {
          res.data.schema.fields.forEach((f: FormField) => {
            initial[f.id] = '';
          });
        }
        setFormData(initial);
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
          'Este formulário não está disponível, já foi respondido ou expirou.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [publicId]);

  const handleChange = (id: string, value: any) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (fieldErrors[id]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    if (!schema?.fields) return true;
    const errors: Record<string, string> = {};

    for (const field of schema.fields) {
      const val = formData[field.id];
      if (field.required && (!val || (typeof val === 'string' && !val.trim()))) {
        errors[field.id] = 'Este campo é obrigatório.';
        continue;
      }
      if (val && field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) {
          errors[field.id] = 'Informe um e-mail válido.';
        }
      }
      if (val && field.type === 'phone') {
        const digits = String(val).replace(/\D/g, '');
        if (digits.length < 10) {
          errors[field.id] = 'Informe um telefone completo com DDD.';
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      await axios.post(`/api/flows/public/form/${publicId}/submit`, { data: formData });
      setSubmitted(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-[#39ff14] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400 font-mono text-sm">Carregando formulário seguro ZapTroll...</p>
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#161922] border border-red-500/30 rounded-3xl p-6 text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Formulário Indisponível</h2>
          <p className="text-sm text-gray-400 mb-6">{error}</p>
          <p className="text-xs text-gray-500 font-mono">
            ZapTroll Flow Engine • Verificação de Segurança
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#161922] border border-[#39ff14]/30 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(57,255,20,0.15)] animate-in fade-in">
          <div className="w-16 h-16 bg-[#39ff14]/10 border border-[#39ff14]/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#39ff14]">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Dados Enviados com Sucesso!</h2>
          <p className="text-sm text-gray-300 mb-6 leading-relaxed">
            As informações foram recebidas e o seu atendimento no WhatsApp continuará automaticamente.
          </p>
          <div className="bg-[#0b0e14]/70 border border-white/5 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs font-mono text-[#39ff14] mb-2 font-bold uppercase tracking-wider">
              Resumo do Envio
            </p>
            <div className="space-y-1.5 text-xs text-gray-300 max-h-48 overflow-y-auto">
              {Object.entries(formData).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 py-1">
                  <span className="text-gray-400 capitalize">{k}:</span>
                  <span className="font-medium text-white truncate ml-2 max-w-[200px]">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#39ff14]/10 border border-[#39ff14]/20 text-xs text-[#39ff14] font-mono mb-4">
            💬 Você já pode fechar esta tela ou tocar no botão abaixo para retornar à conversa no WhatsApp.
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.close();
              }
            }}
            className="w-full py-3 bg-[#39ff14] hover:bg-[#32e012] text-black font-bold font-mono text-sm rounded-2xl shadow-[0_0_20px_rgba(57,255,20,0.3)] transition flex items-center justify-center gap-2"
          >
            ← Concluir e Retornar ao WhatsApp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full mx-auto">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161922] border border-[#39ff14]/30 text-xs font-mono text-[#39ff14] mb-3">
            <ShieldCheck className="w-4 h-4" />
            <span>ZapTroll Secure Form • Proteção Ponta a Ponta</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{schema.title}</h1>
          {schema.description && (
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">{schema.description}</p>
          )}
        </div>

        {/* Form Card */}
        <div className="bg-[#161922] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {schema.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-300 font-mono">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    placeholder={field.placeholder || 'Digite aqui...'}
                    className={`w-full bg-[#0b0e14] border rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                      fieldErrors[field.id]
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-white/10 focus:border-[#39ff14]'
                    }`}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className="w-full bg-[#0b0e14] border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#39ff14] transition-all"
                  >
                    <option value="">Selecione uma opção...</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className={`w-full bg-[#0b0e14] border rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all ${
                      fieldErrors[field.id]
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-white/10 focus:border-[#39ff14]'
                    }`}
                  />
                )}

                {fieldErrors[field.id] && (
                  <p className="text-xs text-red-400 font-mono mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{fieldErrors[field.id]}</span>
                  </p>
                )}
              </div>
            ))}

            {expiresAt && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>Link expira em: {new Date(expiresAt).toLocaleTimeString()}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#39ff14] hover:bg-[#32e012] text-black font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:shadow-[0_0_30px_rgba(57,255,20,0.5)] transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Enviando dados...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{schema.submitButtonText || 'Confirmar e Continuar no WhatsApp'}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-gray-500 font-mono">
            <Lock className="w-3 h-3" />
            <span>Criptografia ponta a ponta • Token de uso único restrito</span>
          </div>
        </div>
      </div>
    </div>
  );
};
