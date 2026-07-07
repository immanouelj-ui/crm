import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Check, X, AlertCircle, Trash2, Calendar } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../App';

const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_H = 56; // hauteur en px d'une heure

// Calcule la disposition côte-à-côte pour les RDV qui se chevauchent
function computeDayLayout(appts) {
  const sorted = [...appts].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));
  const cols = []; // chaque colonne contient le end_time du dernier RDV
  const layout = {};
  for (const a of sorted) {
    const start = parseTime(a.start_time);
    const end = parseTime(a.end_time);
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      if (cols[c] <= start) { cols[c] = end; layout[a.id] = c; placed = true; break; }
    }
    if (!placed) { layout[a.id] = cols.length; cols.push(end); }
  }
  const totalCols = cols.length || 1;
  // Calcule le vrai max de colonnes simultanées pour chaque RDV
  const result = {};
  for (const a of sorted) {
    const start = parseTime(a.start_time);
    const end = parseTime(a.end_time);
    const concurrent = sorted.filter(b => parseTime(b.start_time) < end && parseTime(b.end_time) > start);
    const maxCol = Math.max(...concurrent.map(b => layout[b.id]));
    result[a.id] = { col: layout[a.id], totalCols: maxCol + 1 };
  }
  return result;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function fmt(h, m = 0) {
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function parseTime(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

const PALETTE = [
  'bg-indigo-500 border-indigo-600 text-white',
  'bg-violet-500 border-violet-600 text-white',
  'bg-pink-500 border-pink-600 text-white',
  'bg-teal-500 border-teal-600 text-white',
  'bg-emerald-500 border-emerald-600 text-white',
  'bg-orange-500 border-orange-600 text-white',
  'bg-cyan-500 border-cyan-600 text-white',
  'bg-rose-500 border-rose-600 text-white',
  'bg-blue-500 border-blue-600 text-white',
  'bg-fuchsia-500 border-fuchsia-600 text-white',
  'bg-lime-500 border-lime-600 text-white',
  'bg-amber-600 border-amber-700 text-white',
];

function apptColor(appt) {
  if (appt.status === 'pending') return 'bg-amber-400 border-amber-500 text-white';
  if (appt.status === 'cancelled') return 'bg-gray-300 border-gray-400 text-gray-500 line-through';
  const seed = (appt.contact_id || 0) + (appt.assigned_to || 0) * 7 + (appt.id || 0) * 3;
  return PALETTE[Math.abs(seed) % PALETTE.length];
}

// ── Modale création / demande RDV ─────────────────────────────────────────────
function AppointmentModal({ date, startTime, endTime, contacts, isAdmin, apptLevel, onClose, onSave }) {
  const [form, setForm] = useState({
    contact_id: '',
    title: '',
    date: date || toDateStr(new Date()),
    start_time: startTime || '09:00',
    end_time: endTime || '09:30',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const appt = await api.createAppointment(form);
      onClose();
      onSave(appt);
    } catch (err) { setError(err.message); setLoading(false); }
  }

  const isRequest = apptLevel === 'request';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">
              {isRequest ? 'Demander un RDV' : 'Nouveau RDV'}
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
          </div>
          {isRequest && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 text-sm text-amber-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5"/>
              Votre demande sera envoyée à l'administrateur pour validation.
            </div>
          )}
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
              <select value={form.contact_id} onChange={e => setForm(f=>({...f,contact_id:e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">— Sans contact —</option>
                {contacts.map(c => {
                  const d = c.custom_data || {};
                  return <option key={c.id} value={c.id}>{d.nom || d.name || c.id}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
              <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))}
                placeholder="RDV commercial, Appel découverte…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f=>({...f,end_time:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"/>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {loading ? '…' : isRequest ? 'Envoyer la demande' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Modale détail RDV ─────────────────────────────────────────────────────────
function AppointmentDetail({ appt, isAdmin, apptLevel, onClose, onUpdate, onDelete }) {
  const [loading, setLoading] = useState(false);

  async function updateStatus(status) {
    setLoading(true);
    try {
      const updated = await api.updateAppointment(appt.id, { status });
      onClose();
      onUpdate(updated);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  async function del() {
    if (!confirm('Supprimer ce RDV ?')) return;
    await api.deleteAppointment(appt.id);
    onDelete(appt.id);
    onClose();
  }

  const contactName = appt.contact_data ? (appt.contact_data.nom || appt.contact_data.name || '—') : '—';
  const canConfirm = isAdmin || apptLevel === 'confirm';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">{appt.title || 'RDV'}</h2>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                appt.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                appt.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-500'}`}>
                {appt.status === 'confirmed' ? 'Confirmé' : appt.status === 'pending' ? 'En attente' : 'Annulé'}
              </span>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
          </div>

          <div className="space-y-2 text-sm text-gray-700 mb-5">
            <div className="flex items-center gap-2"><Calendar size={14} className="text-gray-400"/>
              {appt.date} · {appt.start_time} – {appt.end_time}
            </div>
            <div className="flex items-center gap-2"><User size={14} className="text-gray-400"/>
              {contactName}
            </div>
            {appt.assigned_name && (
              <div className="flex items-center gap-2"><User size={14} className="text-gray-400"/>
                Assigné à : {appt.assigned_name}
              </div>
            )}
            {appt.requester_name && (
              <div className="flex items-center gap-2"><AlertCircle size={14} className="text-amber-400"/>
                Demandé par : {appt.requester_name}
              </div>
            )}
            {appt.notes && <p className="text-gray-500 italic mt-1">{appt.notes}</p>}
          </div>

          <div className="flex flex-col gap-2">
            {appt.status === 'pending' && isAdmin && (
              <>
                <button onClick={() => updateStatus('confirmed')} disabled={loading}
                  className="flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  <Check size={15}/> Confirmer
                </button>
                <button onClick={() => updateStatus('cancelled')} disabled={loading}
                  className="flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100">
                  <X size={15}/> Refuser
                </button>
              </>
            )}
            {appt.status === 'confirmed' && canConfirm && (
              <button onClick={() => updateStatus('cancelled')} disabled={loading}
                className="flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                <X size={15}/> Annuler le RDV
              </button>
            )}
            {(isAdmin || apptLevel === 'confirm') && (
              <button onClick={del}
                className="flex items-center justify-center gap-2 py-2 text-red-500 text-sm hover:bg-red-50 rounded-lg">
                <Trash2 size={14}/> Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Réglages disponibilités ───────────────────────────────────────────────────
function AvailabilitySettings({ onClose }) {
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ day_of_week: 1, start_time: '09:00', end_time: '18:00', slot_duration: 30 });

  useEffect(() => { api.getAvailability().then(setSlots); }, []);

  async function addSlot() {
    if (!form.start_time || !form.end_time) return;
    const s = await api.createAvailabilitySlot(form);
    setSlots(prev => [...prev, s]);
  }

  async function deleteSlot(id) {
    await api.deleteAvailabilitySlot(id);
    setSlots(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">Créneaux disponibles</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Ajouter un créneau récurrent</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Jour</label>
                <select value={form.day_of_week} onChange={e => setForm(f=>({...f,day_of_week:+e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Durée créneau (min)</label>
                <select value={form.slot_duration} onChange={e => setForm(f=>({...f,slot_duration:+e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {[15,20,30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Début</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f=>({...f,start_time:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fin</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f=>({...f,end_time:e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
            </div>
            <button onClick={addSlot}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              Ajouter
            </button>
          </div>

          <div className="space-y-2">
            {slots.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun créneau défini</p>}
            {slots.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">{DAYS[s.day_of_week]}</span>
                  <span className="text-sm text-gray-500 ml-2">{s.start_time} – {s.end_time}</span>
                  <span className="text-xs text-gray-400 ml-2">({s.slot_duration} min)</span>
                </div>
                <button onClick={() => deleteSlot(s.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Planning() {
  const { user } = useAuth();
  const isAdminUser = !user?.role || user?.role === 'admin';
  const apptLevel = isAdminUser ? 'confirm' : (user?.permissions?.appointments_level || 'view');

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [newApptSlot, setNewApptSlot] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showPending, setShowPending] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appts, avail, conts] = await Promise.all([
        api.getAppointments(toDateStr(weekStart)),
        api.getAvailability(),
        api.getContacts(),
      ]);
      setAppointments(appts);
      setAvailability(avail);
      setContacts(conts);
      if (isAdminUser) {
        const { count } = await api.getPendingCount();
        setPendingCount(count);
      }
    } finally { setLoading(false); }
  }, [weekStart, isAdminUser]);

  useEffect(() => { loadData(); }, [loadData]);

  function prevWeek() { setWeekStart(d => addDays(d, -7)); }
  function nextWeek() { setWeekStart(d => addDays(d, 7)); }
  function goToday()  { setWeekStart(getWeekStart(new Date())); }

  function isAvailable(dayOfWeek, hour) {
    return availability.some(s =>
      s.day_of_week === dayOfWeek &&
      parseTime(s.start_time) <= hour * 60 &&
      parseTime(s.end_time) > hour * 60
    );
  }

  const pendingAppts = appointments.filter(a => a.status === 'pending');
  const displayHours = HOURS.filter(h => h >= 7 && h <= 20);

  function handleSlotClick(dayStr, hour, dayOfWeek) {
    if (apptLevel === 'view') return;
    if (!isAvailable(dayOfWeek, hour) && !isAdminUser) return;
    setNewApptSlot({ date: dayStr, start_time: fmt(hour), end_time: fmt(hour, 30) });
    setShowCreate(true);
  }

  function handleSaveAppt(appt) {
    setAppointments(prev => [...prev, appt]);
    if (appt.status === 'pending' && isAdminUser) setPendingCount(c => c + 1);
  }

  function handleUpdateAppt(updated) {
    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
    if (isAdminUser) {
      const wasPending = appointments.find(a => a.id === updated.id)?.status === 'pending';
      if (wasPending && updated.status !== 'pending') setPendingCount(c => Math.max(0, c - 1));
    }
  }

  function handleDeleteAppt(id) {
    const appt = appointments.find(a => a.id === id);
    setAppointments(prev => prev.filter(a => a.id !== id));
    if (appt?.status === 'pending') setPendingCount(c => Math.max(0, c - 1));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={prevWeek} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18}/></button>
          <button onClick={goToday} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Aujourd'hui</button>
          <button onClick={nextWeek} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={18}/></button>
          <span className="text-sm font-semibold text-gray-700">
            Semaine du {weekStart.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAdminUser && pendingCount > 0 && (
            <button onClick={() => setShowPending(!showPending)}
              className="relative flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm hover:bg-amber-100">
              <AlertCircle size={15}/>
              {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente
            </button>
          )}
          {isAdminUser && (
            <button onClick={() => setShowSettings(true)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Créneaux dispo
            </button>
          )}
          {apptLevel !== 'view' && (
            <button onClick={() => { setNewApptSlot(null); setShowCreate(true); }}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Plus size={15}/> {apptLevel === 'request' ? 'Demander un RDV' : 'Nouveau RDV'}
            </button>
          )}
        </div>
      </div>

      {/* Panneau demandes en attente */}
      {showPending && pendingAppts.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Demandes en attente de validation</h3>
          <div className="flex flex-wrap gap-2">
            {pendingAppts.map(a => {
              const cname = a.contact_data ? (a.contact_data.nom || a.contact_data.name || '—') : '—';
              return (
                <div key={a.id} className="flex items-center gap-3 bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{a.title || 'RDV'}</span>
                    <span className="text-gray-500 ml-2">{a.date} {a.start_time}</span>
                    {a.requester_name && <span className="text-gray-400 ml-2">· {a.requester_name}</span>}
                    {cname !== '—' && <span className="text-gray-400 ml-2">· {cname}</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={async () => { try { const u = await api.updateAppointment(a.id, { status: 'confirmed' }); handleUpdateAppt(u); } catch(e) { alert(e.message); } }}
                      className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200" title="Confirmer"><Check size={13}/></button>
                    <button onClick={async () => { try { const u = await api.updateAppointment(a.id, { status: 'cancelled' }); handleUpdateAppt(u); } catch(e) { alert(e.message); } }}
                      className="p-1 bg-red-100 text-red-500 rounded hover:bg-red-200" title="Refuser"><X size={13}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendrier */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Chargement…</div>
        ) : (
          <div className="min-w-[700px]">
            {/* En-tête jours */}
            <div className="grid sticky top-0 z-10 bg-white border-b border-gray-200" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              <div/>
              {weekDays.map((d, i) => {
                const today = toDateStr(new Date()) === toDateStr(d);
                return (
                  <div key={i} className={`py-2 text-center border-l border-gray-100 ${today ? 'bg-indigo-50' : ''}`}>
                    <div className="text-xs text-gray-500">{DAYS_SHORT[d.getDay()]}</div>
                    <div className={`text-sm font-semibold mt-0.5 ${today ? 'text-indigo-600' : 'text-gray-800'}`}>
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Corps calendrier */}
            <div className="flex">
              {/* Colonne heures */}
              <div className="w-14 flex-shrink-0">
                {displayHours.map(h => (
                  <div key={h} style={{ height: CELL_H }} className="border-b border-gray-100 flex items-start justify-end pr-2 pt-1">
                    <span className="text-xs text-gray-400">{fmt(h)}</span>
                  </div>
                ))}
              </div>

              {/* 7 colonnes de jours */}
              {weekDays.map((d, di) => {
                const dayStr = toDateStr(d);
                const today = toDateStr(new Date()) === dayStr;
                const dayAppts = appointments.filter(a => a.date === dayStr);
                const layout = computeDayLayout(dayAppts);

                return (
                  <div key={di} className={`flex-1 border-l border-gray-100 relative ${today ? 'bg-indigo-50/20' : ''}`}
                    style={{ height: displayHours.length * CELL_H }}>

                    {/* Lignes d'heures */}
                    {displayHours.map((h, hi) => (
                      <div key={h} style={{ position: 'absolute', top: hi * CELL_H, left: 0, right: 0, height: CELL_H }}
                        className={`border-b border-gray-100 transition-colors
                          ${isAvailable(d.getDay(), h) ? 'bg-green-50/50' : ''}
                          ${apptLevel !== 'view' && (isAvailable(d.getDay(), h) || isAdminUser) ? 'cursor-pointer hover:bg-indigo-50/60' : ''}
                        `}
                        onClick={() => handleSlotClick(dayStr, h, d.getDay())}
                      />
                    ))}

                    {/* RDV positionnés absolument */}
                    {dayAppts.map(a => {
                      const { col, totalCols } = layout[a.id] || { col: 0, totalCols: 1 };
                      const startMin = parseTime(a.start_time);
                      const endMin = parseTime(a.end_time);
                      const top = (startMin - displayHours[0] * 60) / 60 * CELL_H + 2;
                      const height = Math.max((endMin - startMin) / 60 * CELL_H - 4, 20);
                      const leftPct = (col / totalCols) * 100;
                      const widthPct = 100 / totalCols;
                      const cname = a.contact_data ? (a.contact_data.nom || a.contact_data.name) : null;
                      return (
                        <div
                          key={a.id}
                          onClick={e => { e.stopPropagation(); setSelectedAppt(a); }}
                          className={`absolute rounded-md border text-xs p-1 overflow-hidden cursor-pointer hover:opacity-90 z-10 ${apptColor(a)}`}
                          style={{ top, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                        >
                          <div className="font-medium truncate leading-tight">{a.title || 'RDV'}</div>
                          {cname && <div className="opacity-80 truncate">{cname}</div>}
                          <div className="opacity-70">{a.start_time}–{a.end_time}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {showCreate && (
        <AppointmentModal
          date={newApptSlot?.date}
          startTime={newApptSlot?.start_time}
          endTime={newApptSlot?.end_time}
          contacts={contacts}
          isAdmin={isAdminUser}
          apptLevel={apptLevel}
          onClose={() => setShowCreate(false)}
          onSave={handleSaveAppt}
        />
      )}
      {selectedAppt && (
        <AppointmentDetail
          appt={selectedAppt}
          isAdmin={isAdminUser}
          apptLevel={apptLevel}
          onClose={() => setSelectedAppt(null)}
          onUpdate={handleUpdateAppt}
          onDelete={handleDeleteAppt}
        />
      )}
      {showSettings && <AvailabilitySettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
