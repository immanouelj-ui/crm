import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, Check, X, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';

const PERMISSION_LABELS = {
  dashboard:     { label: 'Tableau de bord', desc: 'Voir les statistiques', type: 'toggle' },
  contacts:      { label: 'Contacts',         desc: 'Accéder à la liste des contacts', type: 'toggle' },
  opportunities: { label: 'Opportunités',     desc: 'Pipeline commercial', type: 'toggle' },
  billing:       { label: 'Facturation',      desc: 'Devis et factures', type: 'toggle' },
  messaging:     { label: 'Messagerie',       desc: 'Email et WhatsApp', type: 'toggle' },
  settings:      { label: 'Paramètres',       desc: 'Configurer l\'entreprise', type: 'toggle' },
  appointments_level: {
    label: 'Planning RDV',
    desc: 'Accès au calendrier',
    type: 'select',
    options: [
      { value: 'none',    label: 'Aucun accès' },
      { value: 'view',    label: 'Voir seulement' },
      { value: 'request', label: 'Faire des demandes (admin valide)' },
      { value: 'confirm', label: 'Créer et confirmer' },
    ],
  },
};

const DEFAULT_PERMISSIONS = {
  dashboard: true, contacts: true, opportunities: true,
  billing: false, messaging: false, settings: false,
  appointments_level: 'none',
};

function PermissionToggle({ perm, label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="text-xs text-gray-400">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function MemberCard({ member, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [perms, setPerms] = useState(member.permissions);
  const [name, setName] = useState(member.name);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body = { name, permissions: perms };
      if (newPassword) body.password = newPassword;
      const updated = await api.updateEmployee(member.id, body);
      onUpdate(updated);
      setEditing(false);
      setNewPassword('');
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              {editing ? (
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="text-sm font-semibold border border-gray-300 rounded px-2 py-1"
                />
              ) : (
                <div className="font-semibold text-gray-800">{member.name}</div>
              )}
              <div className="text-xs text-gray-500">{member.email}</div>
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={save} disabled={saving} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100">
                  <Check size={15} />
                </button>
                <button onClick={() => { setEditing(false); setPerms(member.permissions); setName(member.name); setNewPassword(''); }} className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100">
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => onDelete(member.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        </div>

        {editing && (
          <div className="mt-3">
            <input
              type="password"
              placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 mb-3"
            />
          </div>
        )}

        <div className="mt-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accès</div>
          {Object.entries(PERMISSION_LABELS).map(([key, def]) => (
            editing ? (
              def.type === 'select' ? (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-700">{def.label}</div>
                    <div className="text-xs text-gray-400">{def.desc}</div>
                  </div>
                  <select value={perms[key] || 'none'} onChange={e => setPerms(p => ({ ...p, [key]: e.target.value }))}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 ml-2">
                    {def.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ) : (
                <PermissionToggle key={key} perm={key} label={def.label} desc={def.desc}
                  value={!!perms[key]} onChange={v => setPerms(p => ({ ...p, [key]: v }))} />
              )
            ) : (
              <div key={key} className="flex items-center gap-2 py-1">
                {def.type === 'select' ? (
                  <>
                    {perms[key] && perms[key] !== 'none'
                      ? <Eye size={13} className="text-indigo-500 shrink-0" />
                      : <EyeOff size={13} className="text-gray-300 shrink-0" />}
                    <span className={`text-xs ${perms[key] && perms[key] !== 'none' ? 'text-gray-700' : 'text-gray-300'}`}>
                      {def.label} — {def.options?.find(o => o.value === (perms[key] || 'none'))?.label}
                    </span>
                  </>
                ) : (
                  <>
                    {perms[key] ? <Eye size={13} className="text-indigo-500 shrink-0" /> : <EyeOff size={13} className="text-gray-300 shrink-0" />}
                    <span className={`text-xs ${perms[key] ? 'text-gray-700' : 'text-gray-300'}`}>{def.label}</span>
                  </>
                )}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [perms, setPerms] = useState({ ...DEFAULT_PERMISSIONS });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return setError('Tous les champs sont requis');
    setLoading(true);
    setError('');
    try {
      const member = await api.createEmployee({ ...form, permissions: perms });
      onCreate(member);
      onClose();
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">Nouvel employé</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Prénom Nom" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="prenom@entreprise.fr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">Permissions</div>
              {Object.entries(PERMISSION_LABELS).map(([key, def]) => (
                def.type === 'select' ? (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-700">{def.label}</div>
                      <div className="text-xs text-gray-400">{def.desc}</div>
                    </div>
                    <select value={perms[key] || 'none'} onChange={e => setPerms(p => ({ ...p, [key]: e.target.value }))}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1 ml-2">
                      {def.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ) : (
                  <PermissionToggle
                    key={key}
                    perm={key}
                    label={def.label}
                    desc={def.desc}
                    value={!!perms[key]}
                    onChange={v => setPerms(p => ({ ...p, [key]: v }))}
                  />
                )
              ))}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Création…' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api.getTeam().then(setMembers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleDelete(id) {
    if (!confirm('Supprimer cet employé ?')) return;
    await api.deleteEmployee(id);
    setMembers(m => m.filter(x => x.id !== id));
  }

  function handleUpdate(updated) {
    setMembers(m => m.map(x => x.id === updated.id ? updated : x));
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Users size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Mon équipe</h1>
            <p className="text-sm text-gray-500">{members.length} employé{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
        >
          <Plus size={16} /> Ajouter un employé
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : members.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-gray-300" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">Aucun employé</h3>
          <p className="text-sm text-gray-400 mb-4">Ajoutez des membres pour partager l'accès au CRM</p>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
            Ajouter le premier employé
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(m => (
            <MemberCard key={m.id} member={m} onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={m => setMembers(prev => [...prev, m])} />
      )}
    </div>
  );
}
