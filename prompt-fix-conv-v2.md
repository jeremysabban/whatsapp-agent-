# FIX Conv. V2 — 2 bugs critiques

## BUG 1 : La conversation se ferme toute seule (retour à "Sélectionnez une conversation")

### CAUSE

Le composant `ConversationsV2` est défini COMME UNE FONCTION INLINE dans `WhatsAppAgent.jsx` (L.1716). C'est une **fonction déclarée à l'intérieur du render** du composant parent :

```javascript
// WhatsAppAgent.jsx L.1716
const ConversationsV2 = () => {
  const [v2SelectedConv, setV2SelectedConv] = useState(null);  // ← CE STATE SE RESET
  const [v2Messages, setV2Messages] = useState([]);
  // ...
};
```

À chaque re-render du parent `WhatsAppAgent` (qui arrive souvent : SSE events, loadConversations, timers, etc.), React **détruit et recrée le composant** ConversationsV2 parce que c'est une nouvelle référence de fonction à chaque render. Tous les `useState` sont réinitialisés → `v2SelectedConv` revient à `null` → le chat se ferme.

### FIX

**Option A (rapide)** : Remonter les states v2 au niveau du composant parent WhatsAppAgent, hors de la fonction inline.

À la place de la fonction inline, déclarer les states en haut de `WhatsAppAgent` (vers L.118-130 où sont les autres states) :

```javascript
// Ajouter aux states existants de WhatsAppAgent (vers L.118)
const [v2SelectedConv, setV2SelectedConv] = useState(null);
const [v2Messages, setV2Messages] = useState([]);
const [v2SearchQuery, setV2SearchQuery] = useState('');
const [v2ActiveFilter, setV2ActiveFilter] = useState('all');
const [v2ShowArchived, setV2ShowArchived] = useState(false);
const [v2IsLoadingMessages, setV2IsLoadingMessages] = useState(false);
const [v2IsSending, setV2IsSending] = useState(false);
```

Et transformer ConversationsV2 en un simple rendu (plus de useState à l'intérieur) :

```javascript
const ConversationsV2 = () => {
  // Toutes les fonctions handlers utilisent les states remontés au parent
  // Plus de useState ici

  const v2Conversations = useMemo(() => {
    if (v2ShowArchived) return conversations.filter(c => c.status === 'hsva');
    return conversations.filter(c => c.status !== 'hsva');
  }, [conversations, v2ShowArchived]);

  const handleSelectConversation = useCallback(async (conv) => {
    if (!conv) { setV2SelectedConv(null); setV2Messages([]); return; }
    setV2SelectedConv(conv);
    setV2IsLoadingMessages(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${encodeURIComponent(conv.jid)}`);
      const data = await res.json();
      setV2Messages(data.messages || []);
    } catch (err) { console.error('Error loading messages:', err); }
    setV2IsLoadingMessages(false);
  }, []);

  const handleSendMessage = useCallback(async (jid, text) => {
    if (!text.trim() || v2IsSending) return;
    setV2IsSending(true);
    const optId = `opt_${Date.now()}`;
    setV2Messages(prev => [...prev, { id: optId, text, from_me: true, timestamp: Date.now() }]);
    try {
      await api('send', 'POST', { jid, text });
      loadConversations();
    } catch (err) {
      setV2Messages(prev => prev.filter(m => m.id !== optId));
    }
    setV2IsSending(false);
  }, [v2IsSending, loadConversations]);

  return (
    <div className="h-[calc(100vh-8rem)] -m-4 lg:-m-6">
      <ConversationLayout
        conversations={v2Conversations}
        selectedConversation={v2SelectedConv}
        selectedMessages={v2Messages}
        isLoadingMessages={v2IsLoadingMessages}
        isConnected={connected}
        onSelectConversation={handleSelectConversation}
        onSendMessage={handleSendMessage}
        searchQuery={v2SearchQuery}
        onSearchChange={setV2SearchQuery}
        activeFilter={v2ActiveFilter}
        onFilterChange={setV2ActiveFilter}
        isSending={v2IsSending}
      />
    </div>
  );
};
```

**Option B (meilleure, mais plus de travail)** : Extraire ConversationsV2 dans un fichier séparé `src/components/conversations/ConversationsV2Page.jsx` et l'importer. Comme ça c'est un vrai composant stable que React ne recrée pas.

**Choisis l'option A** — c'est le fix le plus rapide et sûr.

AUSSI : s'assurer que les SSE events rafraîchissent aussi les messages V2. Ajouter dans le handler SSE (vers L.678) :

```javascript
// Dans le handler SSE, quand un nouveau message arrive :
if (d.type === 'message' || d.type === 'message_sent') {
  loadConversations();
  // Refresh V2 messages si la conv est ouverte
  if (v2SelectedConv && d.data.jid === v2SelectedConv.jid) {
    fetch(`/api/whatsapp/messages/${encodeURIComponent(d.data.jid)}`)
      .then(r => r.json())
      .then(data => setV2Messages(data.messages || []))
      .catch(() => {});
  }
}
```

---

## BUG 2 : Bouton ✨ IA "Améliorer la rédaction" manquant dans Conv. V2

### CAUSE

Le bouton existe dans l'ancien composant `Detail` (WhatsAppAgent.jsx L.2280-2296) mais n'a jamais été porté dans le nouveau `MessageInput.jsx` de Conv. V2.

### FIX

Modifier `src/components/conversations/MessageInput.jsx` pour ajouter le bouton IA.

Ajouter une prop `onImproveText` et un state `isImproving` au composant :

```jsx
export default function MessageInput({
  onSend,
  // ... props existantes ...
  onImproveText,  // NOUVEAU : callback pour améliorer le texte
}) {
```

Ajouter le bouton ✨ IA **entre le champ de saisie et le bouton envoyer**. Le bouton :
- N'apparaît que quand il y a du texte dans l'input
- Appelle `POST /api/ai/improve-text` avec `{ text, context: 'message WhatsApp professionnel mais cordial' }`
- Remplace le texte de l'input par la version améliorée
- Montre un spinner pendant le chargement
- Style : fond ambre, icône ✨, texte "IA"

Voici le code exact du bouton à ajouter (copié de l'ancien composant L.2280-2296) :

```jsx
// State à ajouter dans MessageInput
const [isImproving, setIsImproving] = useState(false);

// Fonction amélioration
const handleImprove = async () => {
  if (!text.trim() || isImproving) return;
  setIsImproving(true);
  try {
    const res = await fetch('/api/ai/improve-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context: 'message WhatsApp professionnel mais cordial' })
    });
    const data = await res.json();
    if (data.improved) {
      setText(data.improved);
    }
  } catch (err) {
    console.error('Error improving text:', err);
  }
  setIsImproving(false);
};

// Dans le JSX, AVANT le bouton envoyer :
{text.trim() && (
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); handleImprove(); }}
    onMouseDown={(e) => e.preventDefault()}
    disabled={isImproving}
    className={`p-2 rounded-full transition-all ${
      isImproving
        ? 'bg-amber-300 text-amber-700'
        : 'bg-amber-100 hover:bg-amber-200 text-amber-700'
    }`}
    title="Améliorer avec l'IA"
  >
    {isImproving ? (
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    ) : (
      <span className="text-base">✨</span>
    )}
  </button>
)}
```

Le bouton doit être dans la barre d'input, à côté du champ de texte, dans le div des actions.

---

## RÉSUMÉ DES FICHIERS À MODIFIER

1. **`src/components/WhatsAppAgent.jsx`** — Remonter les 7 states de ConversationsV2 au niveau parent + ajouter refresh SSE pour V2
2. **`src/components/conversations/MessageInput.jsx`** — Ajouter le bouton ✨ IA "Améliorer" avec appel à `/api/ai/improve-text`

## COMMENCE par lire les fichiers, puis applique les fixes dans cet ordre.
