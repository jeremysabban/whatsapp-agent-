# Systeme "Brain" - Architecture Audio → Action

## Vue d'ensemble
Systeme de commandes vocales pour le CRM WhatsApp (Smart Value Assurances). L'utilisateur envoie un audio, Gemini le transcrit et extrait une intention structuree, puis des "outils" executent l'action.

## Pipeline complet

```
[Utilisateur clique micro]
    ↓
[MediaRecorder API] → Enregistre en audio/webm
    ↓
[FileReader] → Convertit en Base64
    ↓
POST /api/brain { audioBase64: "..." }
    ↓
[gemini-brain.js] → Gemini 2.5 Flash (multimodal)
    ↓
JSON structure : { intention, content, client?, time?, action? }
    ↓
[gemini-tools.js] → Execute l'action selon l'intention
    ↓
Reponse utilisateur
```

## Fichiers

### 1. `src/lib/gemini-brain.js` - Le Cerveau
```javascript
// Modele: gemini-2.5-flash (audio multimodal)
// Input: audio base64 (ogg/webm/mp3)
// Output: JSON structure avec intention

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: `
    Tu es l'assistant IA executif d'un courtier en assurance (Smart Value).
    Ton role est d'ecouter des notes vocales et d'extraire des actions structurees.

    DATE DU JOUR : ${new Date().toLocaleString('fr-FR')}

    Tes 4 Intentions possibles :
    1. NOTE : Information sur un dossier client existant (ex: "J'ai eu Cohen, il est OK")
    2. RAPPEL : Une alarme precise (ex: "Rappelle-moi dans 20min")
    3. TACHE : Une action a faire sans heure precise (ex: "Faut que je pense a la TVA")
    4. LEAD : Un nouveau prospect (ex: "Nouveau contact, resto Le Napoli...")

    REGLES D'OR :
    - Si l'audio contient une notion de temps ("demain", "a 14h"), c'est un RAPPEL
    - Si l'audio mentionne un nom de client connu ou un numero de dossier, extrait-le
    - Tu dois TOUJOURS repondre en JSON strict, sans markdown
  `,
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.2
  }
});

// Fonction exportee
processAudioCommand(base64Audio, mimeType) → { intention, content, client?, time?, action? }
```

### 2. `src/lib/gemini-tools.js` - Les Mains (Execution)
```javascript
// 3 outils connectes a Notion + systeme de rappels

scheduleReminder(text, timeISO)
→ Ajoute dans data/reminders.json
→ Sera envoye via ntfy (notification push urgente)

addNoteToDossier(clientName, content)
→ Recherche le dossier Notion par nom client (notion.search)
→ Append un bloc "Note Vocale du [date]" dans la page

createTask(taskDescription)
→ Cree une page dans la DB Taches Notion (NOTION_TASKS_DB_ID)
```

### 3. `src/app/api/brain/route.js` - L'API
```javascript
POST /api/brain
Body: { audioBase64: "..." }

Flow:
1. Recoit audio base64
2. processAudioCommand() → analyse Gemini
3. Switch sur intention:
   - RAPPEL → scheduleReminder()
   - NOTE → addNoteToDossier()
   - TACHE → createTask()
4. Retourne { message: "..." }
```

### 4. `src/components/WhatsAppAgent.jsx` - Capture Audio
```javascript
// States
const [isRecording, setIsRecording] = useState(false);
const [brainProcessing, setBrainProcessing] = useState(false);
const [brainResult, setBrainResult] = useState(null);
const mediaRecorderRef = useRef(null);
const audioChunksRef = useRef([]);

// Demarrer l'enregistrement
const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  audioChunksRef.current = [];
  mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
  mediaRecorderRef.current.onstop = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    stream.getTracks().forEach(t => t.stop());
    await sendToBrain(audioBlob);
  };
  mediaRecorderRef.current.start();
  setIsRecording(true);
};

// Envoyer au cerveau
const sendToBrain = async (audioBlob) => {
  setBrainProcessing(true);
  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64 = reader.result.split(',')[1];
    const res = await fetch('/api/brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: base64 })
    });
    const data = await res.json();
    setBrainResult(data);
    setTimeout(() => setBrainResult(null), 5000);
  };
  reader.readAsDataURL(audioBlob);
  setBrainProcessing(false);
};
```

## Format JSON attendu de Gemini

```json
// Pour "Rappelle-moi demain a 14h d'appeler Cohen"
{
  "intention": "RAPPEL",
  "action": "Appeler Cohen",
  "time": "2026-02-07T14:00:00.000Z",
  "client": "Cohen"
}

// Pour "Note sur Dupont : il est OK pour signer"
{
  "intention": "NOTE",
  "client": "Dupont",
  "content": "Client OK pour signer"
}

// Pour "Tache : envoyer devis auto"
{
  "intention": "TACHE",
  "content": "Envoyer devis auto"
}

// Pour "Nouveau prospect resto Le Napoli, contact Jean-Pierre"
{
  "intention": "LEAD",
  "content": "Resto Le Napoli",
  "client": "Jean-Pierre"
}
```

## Systeme de Rappels (ntfy)
Les rappels sont traites cote frontend (`WhatsAppAgent.jsx`) :
- Polling toutes les 30s sur `/api/reminders`
- Si rappel arrive a echeance:
  1. POST vers `ntfy.sh/smartvalue_alerte_jeremy` (priorite urgente, sonne meme en silencieux)
  2. Message WhatsApp de trace sur mon numero perso
  3. Suppression du rappel

## Variables d'environnement (.env.local)
```
GEMINI_API_KEY=AIzaSyAJTIsIEyEnCCRg_SFLJSgAEJcgHl8qxyY
NOTION_API_KEY=...
NOTION_TASKS_DB_ID=...
```

## UI - Boutons Micro

### Bouton flottant (coin bas-droit)
- Violet par defaut
- Rouge + pulse pendant enregistrement
- Spinner pendant traitement Gemini
- Accessible depuis toutes les vues

### Bouton inline (zone message)
- A cote du bouton "Envoyer"
- Meme comportement que le flottant

### Toast de resultat
- Vert si succes, rouge si erreur
- Affiche le message de confirmation
- Disparait apres 5 secondes

## Schema complet

```
[Clic bouton micro violet]
    ↓
[MediaRecorder] → audio/webm
    ↓
[FileReader] → Base64
    ↓
POST /api/brain { audioBase64 }
    ↓
[gemini-brain.js]
    ↓
Gemini 2.5 Flash analyse l'audio
    ↓
{ intention: "RAPPEL", time: "2026-02-07T14:00:00", action: "Appeler Cohen" }
    ↓
[api/brain/route.js] switch(intention)
    ↓
[gemini-tools.js] → scheduleReminder("Appeler Cohen", "2026-02-07T14:00:00")
    ↓
data/reminders.json (nouveau rappel ajoute)
    ↓
[Frontend polling 30s] → rappel arrive a echeance?
    ↓
POST ntfy.sh/smartvalue_alerte_jeremy (priorite: urgent)
    ↓
📱 DRING! Notification push sur telephone
```

## Status
- ✅ Gemini 2.5 Flash operationnel
- ✅ Bouton micro integre (flottant + inline)
- ✅ Traitement audio → JSON → action
- ✅ Rappels via ntfy (sonnerie urgente)
- ✅ Notes sur dossiers Notion
- ✅ Creation de taches Notion
