'use client';
import { useState } from 'react';

export default function ClaudeButton({ dossierId, dossierName, conversationJid, contactName }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (dossierId) {
        await openDossierChat();
      } else if (conversationJid) {
        await openProspectChat();
      }
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openDossierChat = async () => {
    const res = await fetch(`/api/dossiers/${encodeURIComponent(dossierId)}/activity-summary`);
    const d = await res.json();
    if (d.error) { alert(d.error); return; }

    const allContacts = d.contacts || [];
    const activeContracts = (d.contracts || []).filter(c => !c.desactive);

    const contactLines = allContacts.length
      ? allContacts.map(c => `- ${c.name || '?'}${c.email ? ' · ' + c.email : ''}${c.phone ? ' · ' + c.phone : ''}${c.company ? ' · ' + c.company : ''}`).join('\n')
      : '- Aucun contact renseigne';

    const contractLines = activeContracts.length
      ? activeContracts.map(c => `- ${c.name} · ${c.type_assurance || '?'} · ${c.cie_details || '?'} · effet ${c.date_effet || '?'}`).join('\n')
      : 'Aucun contrat actif';

    const compagnies = [...new Set(activeContracts.map(c => c.cie_details).filter(Boolean))].join(', ') || 'non renseigne';
    const emailLines = (d.emailContext || []).slice(0, 20);
    const emailSection = emailLines.length ? emailLines.join('\n') : 'Aucun email trouve.';
    const searchTermsInfo = (d.emailSearchTerms || []).join(', ');

    const prompt = [
      `DOSSIER : ${dossierName || d.dossier?.name || '?'}`,
      `CONTACTS :`, contactLines,
      `COMPAGNIES : ${compagnies}`,
      `CONTRATS ACTIFS :`, contractLines,
      '', 'SOURCES :',
      `- Notion : ${d.dossier?.url || 'non renseigne'}`,
      `- Google Drive : ${d.dossier?.drive_url || 'non renseigne'}`,
      `- WhatsApp : ${d.convJid ? 'thread ' + d.convJid : 'non lie'}`,
      '', `HISTORIQUE EMAILS (6 mois, recherche : ${searchTermsInfo}) :`, emailSection,
      '', 'CONTEXTE RECENT (30 derniers jours) :', d.recentSummary || 'Aucune activite recente.',
      '', 'Analyse l\'ensemble du dossier et donne-moi une vision globale avant de repondre a ma question.',
      '', 'MA QUESTION :', '[tape ici]',
    ].join('\n');

    window.open(`https://claude.ai/project/019d9645-7417-7277-82d4-6c4cd55973af?q=${encodeURIComponent(prompt)}`, '_blank');
  };

  const openProspectChat = async () => {
    let emailSection = 'Aucun email trouve.';
    let searchTermsInfo = '';

    try {
      const gmailRes = await fetch(`/api/whatsapp/gmail-context?jid=${encodeURIComponent(conversationJid)}`);
      const gmailData = await gmailRes.json();
      const emailLines = gmailData.emailContext || [];
      if (emailLines.length) emailSection = emailLines.join('\n');
      searchTermsInfo = (gmailData.emailSearchTerms || []).join(', ');
    } catch {}

    const name = contactName || conversationJid.split('@')[0];

    const prompt = [
      `PROSPECT : ${name}`,
      `WhatsApp : ${conversationJid}`,
      `Statut : Pas de dossier Notion`,
      '',
      `HISTORIQUE EMAILS (6 mois, recherche : ${searchTermsInfo}) :`, emailSection,
      '',
      'Ce prospect n\'a pas encore de dossier. Aide-moi a qualifier son besoin et proposer les prochaines etapes.',
      '', 'MA QUESTION :', '[tape ici]',
    ].join('\n');

    window.open(`https://claude.ai/project/019d9645-7417-7277-82d4-6c4cd55973af?q=${encodeURIComponent(prompt)}`, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#D97757] text-white hover:bg-[#c4684a] transition-colors disabled:opacity-50"
      title="Ouvrir un chat Claude pré-contextualisé"
    >
      {loading ? '...' : '💬 Claude'}
    </button>
  );
}
