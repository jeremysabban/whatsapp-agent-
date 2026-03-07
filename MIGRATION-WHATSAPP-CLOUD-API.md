# Migration vers WhatsApp Cloud API

## Vue d'ensemble

| Étape | Durée | Difficulté |
|-------|-------|------------|
| 1. Compte Meta Business | 10 min | Facile |
| 2. Vérification entreprise | 1-5 jours | Attente |
| 3. App Meta Developer | 20 min | Facile |
| 4. Configuration WhatsApp | 15 min | Facile |
| 5. Déploiement serveur | 30 min | Moyen |
| 6. Adaptation code | 2-3h | Technique |

---

## ÉTAPE 1 : Créer un compte Meta Business

### 1.1 Aller sur Meta Business Suite
```
https://business.facebook.com/overview
```

### 1.2 Créer le compte
- Cliquer "Créer un compte"
- Nom de l'entreprise : **Smart Value** (ou ton nom exact sur Kbis)
- Email pro : ton email
- Pas besoin de page Facebook

### 1.3 Infos à préparer
- Nom légal de l'entreprise
- Adresse du siège
- Numéro SIRET
- Site web (si disponible)

---

## ÉTAPE 2 : Vérification de l'entreprise

### 2.1 Accéder aux paramètres de vérification
```
https://business.facebook.com/settings/security
```
→ "Centre de sécurité" → "Commencer la vérification"

### 2.2 Documents acceptés (1 seul suffit)
- ✅ **Extrait Kbis** (moins de 3 mois) - RECOMMANDÉ
- ✅ Facture EDF/Engie au nom de l'entreprise
- ✅ Relevé bancaire pro (masquer les montants)
- ✅ Licence commerciale

### 2.3 Processus
1. Uploader le document
2. Meta vérifie (1-5 jours ouvrés)
3. Tu reçois un email de confirmation

### 2.4 Si refusé
- Vérifier que le nom correspond EXACTEMENT au Kbis
- Réessayer avec un autre document

---

## ÉTAPE 3 : Créer l'App Meta Developer

### 3.1 Aller sur Meta for Developers
```
https://developers.facebook.com/apps
```

### 3.2 Créer une nouvelle app
1. Cliquer "Créer une app"
2. Type : **"Business"**
3. Nom : "WhatsApp Agent Smart Value"
4. Email de contact : ton email
5. Associer à ton Business Manager (créé à l'étape 1)

### 3.3 Ajouter le produit WhatsApp
1. Dans le dashboard de l'app → "Ajouter des produits"
2. Trouver **"WhatsApp"** → Cliquer "Configurer"
3. Accepter les conditions

---

## ÉTAPE 4 : Configuration WhatsApp

### 4.1 Accéder à la config WhatsApp
Dans ton app → Menu gauche → **WhatsApp** → **Démarrage rapide**

### 4.2 Créer un numéro de test (temporaire)
Meta fournit un numéro de test gratuit pour commencer :
- Va dans "Numéros de téléphone de test"
- Note le **Phone Number ID** et le **WhatsApp Business Account ID**

### 4.3 Ajouter ton vrai numéro (après vérification entreprise)
1. WhatsApp → "Numéros de téléphone" → "Ajouter un numéro"
2. Entrer : **+33 X XX XX XX XX** (ton numéro dédié)
3. Méthode de vérification : SMS ou appel vocal
4. Entrer le code reçu

⚠️ **IMPORTANT** : Ce numéro sera DÉCONNECTÉ de WhatsApp mobile !

### 4.4 Récupérer les credentials
Dans la config WhatsApp, note :
```
WHATSAPP_PHONE_NUMBER_ID=xxxxxxxxxxxx
WHATSAPP_BUSINESS_ACCOUNT_ID=xxxxxxxxxxxx
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx... (token temporaire)
```

### 4.5 Créer un token permanent
1. Paramètres Business → Utilisateurs système → Ajouter
2. Nom : "WhatsApp Agent"
3. Rôle : Admin
4. Générer un token avec les permissions :
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`

---

## ÉTAPE 5 : Déploiement du serveur

### Option A : Railway (Recommandé - Simple)

#### 5A.1 Créer un compte Railway
```
https://railway.app
```
- Sign up avec GitHub

#### 5A.2 Nouveau projet
1. "New Project" → "Deploy from GitHub repo"
2. Sélectionner le repo `whatsapp-agent`
3. Railway détecte automatiquement Node.js

#### 5A.3 Variables d'environnement
Dans Railway → Settings → Variables, ajouter :
```
WHATSAPP_PHONE_NUMBER_ID=xxxxx
WHATSAPP_BUSINESS_ACCOUNT_ID=xxxxx
WHATSAPP_ACCESS_TOKEN=xxxxx
WHATSAPP_VERIFY_TOKEN=ton_token_secret_123
NOTION_API_KEY=xxxxx (ta clé actuelle)
NOTION_CONTACTS_DB=xxxxx
NOTION_DOSSIERS_DB=xxxxx
GEMINI_API_KEY=xxxxx (si tu utilises Gemini)
```

#### 5A.4 Domaine public
Railway → Settings → Networking → Generate Domain
Tu obtiens : `https://whatsapp-agent-xxx.up.railway.app`

---

### Option B : Vercel (Alternative)

#### 5B.1 Installer Vercel CLI
```bash
npm install -g vercel
```

#### 5B.2 Déployer
```bash
cd whatsapp-agent
vercel
```

#### 5B.3 Variables d'environnement
```bash
vercel env add WHATSAPP_PHONE_NUMBER_ID
vercel env add WHATSAPP_ACCESS_TOKEN
# etc.
```

---

## ÉTAPE 6 : Configurer le Webhook Meta

### 6.1 URL du webhook
Ton URL sera :
```
https://ton-domaine.railway.app/api/whatsapp/webhook
```

### 6.2 Dans Meta Developer
1. WhatsApp → Configuration → Webhook
2. URL de callback : `https://ton-domaine/api/whatsapp/webhook`
3. Token de vérification : `ton_token_secret_123` (même que WHATSAPP_VERIFY_TOKEN)
4. Cliquer "Vérifier et enregistrer"

### 6.3 S'abonner aux événements
Cocher :
- ✅ `messages` - Recevoir les messages entrants
- ✅ `message_status` - Statut de livraison (envoyé, lu)

---

## ÉTAPE 7 : Adaptation du code

### 7.1 Nouveau fichier : `/src/lib/whatsapp-cloud.js`

```javascript
// Client WhatsApp Cloud API
const GRAPH_API = 'https://graph.facebook.com/v18.0';

export async function sendMessage(to, text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace('+', ''), // Format: 33612345678
      type: 'text',
      text: { body: text }
    })
  });

  return response.json();
}

export async function sendDocument(to, documentUrl, filename, caption) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'document',
      document: {
        link: documentUrl,
        filename: filename,
        caption: caption
      }
    })
  });

  return response.json();
}

export async function downloadMedia(mediaId) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  // 1. Get media URL
  const mediaInfo = await fetch(`${GRAPH_API}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());

  // 2. Download media
  const mediaData = await fetch(mediaInfo.url, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.arrayBuffer());

  return {
    buffer: Buffer.from(mediaData),
    mimetype: mediaInfo.mime_type,
    filename: mediaInfo.filename || `media_${mediaId}`
  };
}

export function getStatus() {
  // Cloud API is always connected
  return { status: 'connected' };
}
```

### 7.2 Nouveau endpoint webhook : `/src/app/api/whatsapp/webhook/route.js`

```javascript
import { NextResponse } from 'next/server';
import { insertMessage, upsertConversation, updateConversationLastMessage } from '@/lib/database';

// Verification endpoint (GET)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] Verified!');
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Receive messages (POST)
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('[Webhook] Received:', JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages) {
      for (const msg of value.messages) {
        await processIncomingMessage(msg, value);
      }
    }

    if (value?.statuses) {
      for (const status of value.statuses) {
        console.log(`[Webhook] Message ${status.id}: ${status.status}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function processIncomingMessage(msg, value) {
  const from = msg.from; // 33612345678
  const jid = `${from}@s.whatsapp.net`;
  const msgId = msg.id;
  const timestamp = parseInt(msg.timestamp) * 1000;

  // Get contact name
  const contact = value.contacts?.find(c => c.wa_id === from);
  const pushName = contact?.profile?.name || from;

  // Upsert conversation
  upsertConversation(jid, pushName, from);

  // Extract message content
  let text = null;
  let msgType = 'text';
  let mediaId = null;

  if (msg.type === 'text') {
    text = msg.text.body;
  } else if (msg.type === 'image') {
    text = msg.image.caption || '📷 Photo';
    msgType = 'image';
    mediaId = msg.image.id;
  } else if (msg.type === 'video') {
    text = msg.video.caption || '🎥 Vidéo';
    msgType = 'video';
    mediaId = msg.video.id;
  } else if (msg.type === 'document') {
    text = msg.document.caption || `📎 ${msg.document.filename}`;
    msgType = 'document';
    mediaId = msg.document.id;
  } else if (msg.type === 'audio') {
    text = '🎤 Audio';
    msgType = 'audio';
    mediaId = msg.audio.id;
  } else if (msg.type === 'sticker') {
    text = '🏷️ Sticker';
    msgType = 'sticker';
  } else {
    text = `[${msg.type}]`;
  }

  // Insert message
  insertMessage(msgId, jid, false, pushName, text, timestamp, msgType, msgType === 'document', null, null);
  updateConversationLastMessage(jid, text, timestamp);

  // TODO: Download media if needed
  if (mediaId) {
    // Queue media download
    console.log(`[Webhook] Media to download: ${mediaId}`);
  }

  console.log(`[Webhook] 📨 ${pushName}: ${text}`);
}
```

### 7.3 Modifier `/src/app/api/whatsapp/send/route.js`

```javascript
import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/whatsapp-cloud';
import { insertMessage, updateConversationLastMessage } from '@/lib/database';

export async function POST(request) {
  try {
    const { jid, message } = await request.json();

    // Extract phone number from jid
    const phone = jid.replace('@s.whatsapp.net', '').replace('@lid', '');

    // Send via Cloud API
    const result = await sendMessage(phone, message);

    if (result.messages?.[0]?.id) {
      const msgId = result.messages[0].id;
      const timestamp = Date.now();

      // Log to database
      insertMessage(msgId, jid, true, 'Moi', message, timestamp, 'text', false, null, null);
      updateConversationLastMessage(jid, message, timestamp);

      return NextResponse.json({ success: true, messageId: msgId });
    }

    return NextResponse.json({ error: result.error?.message || 'Unknown error' }, { status: 500 });
  } catch (err) {
    console.error('[Send] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### 7.4 Modifier `/src/app/api/whatsapp/status/route.js`

```javascript
import { NextResponse } from 'next/server';

export async function GET() {
  // Cloud API is always connected
  return NextResponse.json({
    status: 'connected',
    type: 'cloud_api'
  });
}
```

### 7.5 Supprimer les anciens fichiers Baileys
- Garder comme backup, mais ils ne seront plus utilisés
- `/src/lib/whatsapp-client.js` → renommer en `whatsapp-client-baileys.js.backup`

---

## ÉTAPE 8 : Fichier .env.local final

```env
# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxx...
WHATSAPP_VERIFY_TOKEN=mon_secret_token_123

# Notion
NOTION_API_KEY=secret_xxxxx
NOTION_CONTACTS_DB=xxxxx
NOTION_DOSSIERS_DB=xxxxx
NOTION_PROJECTS_DB=xxxxx

# Gemini (si utilisé)
GEMINI_API_KEY=xxxxx

# App
NODE_ENV=production
```

---

## ÉTAPE 9 : Checklist finale

### Avant de déployer
- [ ] Compte Meta Business créé
- [ ] Entreprise vérifiée
- [ ] App Developer créée
- [ ] Numéro WhatsApp configuré
- [ ] Token permanent généré
- [ ] Code adapté
- [ ] Variables d'environnement prêtes

### Après déploiement
- [ ] Webhook vérifié par Meta (coche verte)
- [ ] Test envoi de message
- [ ] Test réception de message
- [ ] Test téléchargement média

---

## FAQ

### Je peux garder mon numéro WhatsApp perso ?
Non, le numéro utilisé avec l'API ne peut plus être utilisé sur l'app mobile.
**Solution** : Utilise un nouveau numéro dédié au CRM.

### Les anciens messages seront perdus ?
Les messages dans ta base SQLite restent. Mais l'historique WhatsApp du nouveau numéro sera vide au départ.

### C'est vraiment gratuit ?
Oui, jusqu'à 1000 conversations/mois. Une conversation = 24h d'échanges avec un contact.

### Combien de temps pour tout setup ?
- Si entreprise déjà vérifiée : ~2h
- Si vérification nécessaire : 1-5 jours d'attente + 2h de setup

---

## Support

- Doc officielle : https://developers.facebook.com/docs/whatsapp/cloud-api
- Statut API : https://metastatus.com
