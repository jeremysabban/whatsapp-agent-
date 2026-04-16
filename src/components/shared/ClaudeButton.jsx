'use client';
import { useState } from 'react';

export default function ClaudeButton({ dossierId, dossierName }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dossiers/${encodeURIComponent(dossierId)}/activity-summary`);
      const d = await res.json();
      if (d.error) { alert(d.error); return; }

      const contact = d.contacts?.[0];
      const activeContracts = (d.contracts || []).filter(c => !c.desactive);

      const contractLines = activeContracts.length
        ? activeContracts.map(c => `- ${c.name} · ${c.type_assurance || '?'} · ${c.cie_details || '?'} · effet ${c.date_effet || '?'}`).join('\n')
        : 'Aucun contrat actif';

      const compagnies = [...new Set(activeContracts.map(c => c.cie_details).filter(Boolean))].join(', ') || 'non renseigné';

      const prompt = [
        `DOSSIER : ${dossierName || d.dossier?.name || '?'}`,
        `CONTACT : ${contact?.name || '?'} · ${contact?.email || ''} · ${contact?.phone || ''}`,
        `COMPAGNIES : ${compagnies}`,
        `CONTRATS ACTIFS :`,
        contractLines,
        '',
        'SOURCES A CONSULTER AVANT DE REPONDRE :',
        `- Notion : ${d.dossier?.url || 'non renseigne'}`,
        `- WhatsApp : ${d.convJid ? 'thread ' + d.convJid : 'non lie'}`,
        `- Emails : recherche Gmail sur "${contact?.email || contact?.name || dossierName}"`,
        '',
        'CONTEXTE RECENT (30 derniers jours) :',
        d.recentSummary || 'Aucune activite recente.',
        '',
        'MA QUESTION :',
        '[tape ici]',
      ].join('\n');

      window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, '_blank');
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#D97757] text-white hover:bg-[#c4684a] transition-colors disabled:opacity-50"
      title="Ouvrir un chat Claude pré-contextualisé avec ce dossier"
    >
      {loading ? '...' : '💬 Claude'}
    </button>
  );
}
