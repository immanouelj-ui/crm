import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Copy, Check, RefreshCw, Code, Globe, Key } from 'lucide-react';

function CodeBlock({ code, language = 'bash' }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function ApiDocs() {
  const [user, setUser] = useState(null);
  const [copying, setCopying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    api.getMe().then(setUser).catch(console.error);
  }, []);

  async function regenerateKey() {
    if (!window.confirm('Régénérer la clé API ? L\'ancienne clé ne fonctionnera plus.')) return;
    setRegenerating(true);
    try {
      const updated = await api.regenerateKey();
      setUser(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setRegenerating(false);
    }
  }

  function copyKey() {
    if (!user?.api_key) return;
    navigator.clipboard.writeText(user.api_key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }

  const apiKey = user?.api_key || 'VOTRE_CLE_API';
  const endpoint = `${window.location.origin}/api/public/leads`;

  const curlExample = `curl -X POST ${endpoint} \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jean Dupont","email":"jean@example.com","company":"ACME","status":"Lead"}'`;

  const jsExample = `// Intégration JavaScript / formulaire web
const response = await fetch('${endpoint}', {
  method: 'POST',
  headers: {
    'X-API-Key': '${apiKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Jean Dupont',
    email: 'jean@example.com',
    company: 'ACME',
    phone: '06 12 34 56 78',
    status: 'Lead',
  }),
});

const lead = await response.json();
console.log('Lead créé:', lead.id);`;

  const htmlFormExample = `<!-- Formulaire HTML avec soumission AJAX -->
<form id="lead-form">
  <input name="name" placeholder="Nom complet" required />
  <input name="email" type="email" placeholder="Email" required />
  <input name="company" placeholder="Entreprise" />
  <input name="phone" placeholder="Téléphone" />
  <button type="submit">Envoyer</button>
</form>

<script>
document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  await fetch('${endpoint}', {
    method: 'POST',
    headers: { 'X-API-Key': '${apiKey}', 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  alert('Merci, nous vous recontacterons !');
});
</script>`;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">API & Intégrations</h1>
        <p className="text-gray-500 text-sm mt-1">Intégrez votre CRM à n'importe quel formulaire ou site web</p>
      </div>

      {/* API Key */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Votre clé API</h2>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Utilisez cette clé pour authentifier vos requêtes à l'endpoint public.
          Ne la partagez pas publiquement.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-sm text-gray-700 truncate">
            {user?.api_key || '...'}
          </div>
          <button
            onClick={copyKey}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            {keyCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
            {keyCopied ? 'Copié' : 'Copier'}
          </button>
          <button
            onClick={regenerateKey}
            disabled={regenerating}
            className="flex items-center gap-2 px-3 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            Régénérer
          </button>
        </div>
      </div>

      {/* Endpoint */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Endpoint public</h2>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded font-mono">POST</span>
          <code className="text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 flex-1">
            {endpoint}
          </code>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <strong>Header requis:</strong> <code className="bg-blue-100 px-1 rounded">X-API-Key: {apiKey.slice(0, 8)}...</code>
          <br />
          <strong>Body:</strong> JSON avec les noms des champs CRM (name, email, phone, company, status, notes...)
        </div>
      </div>

      {/* Examples */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Code className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Exemple cURL</h2>
          </div>
          <CodeBlock code={curlExample} language="bash" />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Code className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Exemple JavaScript (fetch)</h2>
          </div>
          <CodeBlock code={jsExample} language="javascript" />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Code className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Formulaire HTML complet</h2>
          </div>
          <CodeBlock code={htmlFormExample} language="html" />
        </div>
      </div>

      {/* Response example */}
      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Réponse attendue</h2>
        <CodeBlock code={`// HTTP 201 Created
{
  "id": 6,
  "custom_data": {
    "name": "Jean Dupont",
    "email": "jean@example.com",
    "company": "ACME",
    "status": "Lead"
  },
  "created_at": "2024-03-15T10:30:00.000Z",
  "updated_at": "2024-03-15T10:30:00.000Z"
}

// HTTP 401 Unauthorized (clé API invalide)
{ "error": "Clé API invalide" }`} />
      </div>
    </div>
  );
}
