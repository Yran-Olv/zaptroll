/**
 * Utilitários para Exportação e Download de Contatos de Grupos do WhatsApp
 * Suporte completo para:
 * 1. Celulares / Smartphones (Android, iPhone, Google Contacts, iCloud) via arquivo .VCF (vCard 3.0)
 * 2. Whaticket / CRM / Chatwoot via arquivo .CSV formatado (name,number,email com UTF-8 BOM)
 * 3. Excel / Planilhas via .CSV Completo (Nome, Telefone, JID, Cargo, Wa.me)
 * 4. Disparadores / Listas via .TXT (números limpos, 1 por linha)
 * 5. Desenvolvedores via .JSON estruturado
 */

export interface ExportContactItem {
  id: string; // jid, ex: 5511999999999@s.whatsapp.net
  jid?: string;
  lid?: string | null;
  admin?: 'superadmin' | 'admin' | string | null;
  phoneNumber?: string | null;
  cleanNumber?: string | null;
  waMeLink?: string | null;
}

export interface ExportOptions {
  groupName: string;
  prefix?: string;
  filter?: 'all' | 'admins' | 'non-admins';
  includeCountryCode?: boolean; // padrão: true
  startNumber?: number; // padrão: 1
}

/**
 * Normaliza e sanitiza um nome para ser usado em nomes de arquivo
 */
export function sanitizeFilename(name: string): string {
  return (name || 'grupo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 35) || 'contatos';
}

/**
 * Extrai apenas dígitos numéricos válidos de um telefone ou JID
 */
export function extractCleanDigits(contact: ExportContactItem): string {
  if (contact.cleanNumber) {
    return contact.cleanNumber.replace(/\D/g, '');
  }
  if (contact.id) {
    const raw = contact.id.split('@')[0].split(':')[0];
    return raw.replace(/\D/g, '');
  }
  if (contact.phoneNumber) {
    return contact.phoneNumber.replace(/\D/g, '');
  }
  return '';
}

/**
 * Filtra contatos com base nas opções (todos, apenas administradores ou apenas membros comuns)
 */
export function filterContacts(
  contacts: ExportContactItem[],
  filter: 'all' | 'admins' | 'non-admins' = 'all'
): ExportContactItem[] {
  return contacts.filter((c) => {
    const digits = extractCleanDigits(c);
    if (!digits || digits.length < 8) return false;

    const isAdmin = Boolean(c.admin);
    if (filter === 'admins') return isAdmin;
    if (filter === 'non-admins') return !isAdmin;
    return true;
  });
}

/**
 * Escapa strings para formato vCard 3.0
 */
function escapeVcfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * 1. Gera arquivo .VCF (vCard 3.0) para Celulares (Android, iPhone / iOS, Google Contatos)
 * Utiliza quebras de linha CRLF (\r\n) conforme RFC 2426 para máxima compatibilidade com iOS e Android
 */
export function generateVcf(
  contacts: ExportContactItem[],
  options: ExportOptions
): string {
  const filtered = filterContacts(contacts, options.filter);
  const basePrefix = (options.prefix || options.groupName || 'Contato').trim();
  const padLength = filtered.length > 99 ? 3 : 2;

  let vcf = '';
  filtered.forEach((contact, idx) => {
    const digits = extractCleanDigits(contact);
    const numIdx = String((options.startNumber || 1) + idx).padStart(padLength, '0');
    const adminTag = contact.admin ? ' [Admin]' : '';
    const fullName = `${basePrefix}${adminTag} ${numIdx}`;
    const cleanPhone = digits.startsWith('+') ? digits : `+${digits}`;

    // RFC 2426 vCard 3.0 standard block
    vcf += 'BEGIN:VCARD\r\n';
    vcf += 'VERSION:3.0\r\n';
    vcf += `PRODID:-//ZapTroll//WhatsApp Group Contacts Exporter//PT\r\n`;
    vcf += `FN:${escapeVcfText(fullName)}\r\n`;
    vcf += `N:${escapeVcfText(numIdx)};${escapeVcfText(basePrefix)};;;;\r\n`;
    vcf += `TEL;TYPE=CELL,VOICE:${cleanPhone}\r\n`;
    vcf += `CATEGORIES:${escapeVcfText(options.groupName || 'ZapTroll')}\r\n`;
    vcf += `NOTE:${escapeVcfText(`Contato extraído do grupo "${options.groupName}" via ZapTroll`)}\r\n`;
    vcf += 'END:VCARD\r\n';
  });

  return vcf;
}

/**
 * 2. Gera arquivo .CSV formatado especialmente para importação no Whaticket / Chatwoot / CRM
 * Padrão Whaticket: name,number,email
 * O campo 'number' deve conter apenas números com DDI (ex: 5511999999999, sem '+' ou '-')
 * Inclui UTF-8 BOM (\uFEFF) para garantir acentuação correta
 */
export function generateWhaticketCsv(
  contacts: ExportContactItem[],
  options: ExportOptions
): string {
  const filtered = filterContacts(contacts, options.filter);
  const basePrefix = (options.prefix || options.groupName || 'Contato').trim();
  const padLength = filtered.length > 99 ? 3 : 2;

  // UTF-8 BOM + Header
  let csv = '\uFEFFname,number,email\r\n';

  filtered.forEach((contact, idx) => {
    const digits = extractCleanDigits(contact);
    const numIdx = String((options.startNumber || 1) + idx).padStart(padLength, '0');
    const adminTag = contact.admin ? ' [Admin]' : '';
    const name = `${basePrefix}${adminTag} ${numIdx}`.replace(/"/g, '""');

    // Whaticket precisa de apenas dígitos numéricos no campo 'number'
    csv += `"${name}","${digits}",""\r\n`;
  });

  return csv;
}

/**
 * 3. Gera arquivo .CSV Completo (para abrir no Excel / Google Sheets com todas as informações)
 */
export function generateFullExcelCsv(
  contacts: ExportContactItem[],
  options: ExportOptions
): string {
  const filtered = filterContacts(contacts, options.filter);
  const basePrefix = (options.prefix || options.groupName || 'Contato').trim();
  const padLength = filtered.length > 99 ? 3 : 2;

  // UTF-8 BOM + Header
  let csv = '\uFEFF"Nome","TelefoneFormatado","NumeroLimpo","Cargo","JID","LID","LinkWaMe"\r\n';

  filtered.forEach((contact, idx) => {
    const digits = extractCleanDigits(contact);
    const numIdx = String((options.startNumber || 1) + idx).padStart(padLength, '0');
    const role = contact.admin === 'superadmin' ? 'Super Admin' : contact.admin === 'admin' ? 'Admin' : 'Membro';
    const name = `${basePrefix} ${numIdx}`.replace(/"/g, '""');
    const formatted = contact.phoneNumber || `+${digits}`;
    const jid = contact.id || '';
    const lid = contact.lid || '';
    const waLink = contact.waMeLink || `https://wa.me/${digits}`;

    csv += `"${name}","${formatted}","${digits}","${role}","${jid}","${lid}","${waLink}"\r\n`;
  });

  return csv;
}

/**
 * 4. Gera arquivo .TXT com apenas os números limpos (1 por linha)
 * Perfeito para disparadores em massa, Zap turbo, listas de difusão, etc.
 */
export function generateTxtNumbers(
  contacts: ExportContactItem[],
  options: ExportOptions
): string {
  const filtered = filterContacts(contacts, options.filter);
  return filtered
    .map((c) => extractCleanDigits(c))
    .filter((digits) => digits.length >= 8)
    .join('\r\n');
}

/**
 * 5. Gera arquivo .JSON estruturado completo
 */
export function generateJsonExport(
  contacts: ExportContactItem[],
  options: ExportOptions,
  extraMetadata?: any
): string {
  const filtered = filterContacts(contacts, options.filter);
  const data = {
    exportedAt: new Date().toISOString(),
    groupName: options.groupName,
    totalContacts: filtered.length,
    contacts: filtered.map((c, idx) => ({
      index: idx + 1,
      name: `${options.prefix || options.groupName || 'Contato'} ${idx + 1}`,
      cleanNumber: extractCleanDigits(c),
      formattedNumber: c.phoneNumber || null,
      admin: c.admin || null,
      jid: c.id,
      lid: c.lid || null,
      waMeLink: c.waMeLink || `https://wa.me/${extractCleanDigits(c)}`,
    })),
    metadata: extraMetadata || null,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Dispara o download automático do arquivo no navegador do usuário
 */
export function triggerDownload(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Métodos de conveniência de 1 clique para baixar cada formato
 */
export function downloadGroupContactsVcf(
  contacts: ExportContactItem[],
  options: ExportOptions
): number {
  const vcf = generateVcf(contacts, options);
  const safe = sanitizeFilename(options.groupName);
  triggerDownload(vcf, `contatos_celular_${safe}.vcf`, 'text/vcard;charset=utf-8');
  return filterContacts(contacts, options.filter).length;
}

export function downloadGroupContactsWhaticketCsv(
  contacts: ExportContactItem[],
  options: ExportOptions
): number {
  const csv = generateWhaticketCsv(contacts, options);
  const safe = sanitizeFilename(options.groupName);
  triggerDownload(csv, `whaticket_contatos_${safe}.csv`, 'text/csv;charset=utf-8');
  return filterContacts(contacts, options.filter).length;
}

export function downloadGroupContactsFullCsv(
  contacts: ExportContactItem[],
  options: ExportOptions
): number {
  const csv = generateFullExcelCsv(contacts, options);
  const safe = sanitizeFilename(options.groupName);
  triggerDownload(csv, `excel_contatos_${safe}.csv`, 'text/csv;charset=utf-8');
  return filterContacts(contacts, options.filter).length;
}

export function downloadGroupContactsTxt(
  contacts: ExportContactItem[],
  options: ExportOptions
): number {
  const txt = generateTxtNumbers(contacts, options);
  const safe = sanitizeFilename(options.groupName);
  triggerDownload(txt, `telefones_${safe}.txt`, 'text/plain;charset=utf-8');
  return filterContacts(contacts, options.filter).length;
}

export function downloadGroupContactsJson(
  contacts: ExportContactItem[],
  options: ExportOptions,
  extraMetadata?: any
): number {
  const json = generateJsonExport(contacts, options, extraMetadata);
  const safe = sanitizeFilename(options.groupName);
  triggerDownload(json, `grupo_${safe}.json`, 'application/json;charset=utf-8');
  return filterContacts(contacts, options.filter).length;
}
