import { useState } from 'react';
import { Send, Save } from 'lucide-react';
import { getBuildingAddress } from './ContactMap.jsx';
import { installerPhone, installationMessage } from '../lib/installerMessage.js';

export default function InstallerAssignment({ contact, appointments, fields, installers, onSave, onSend }) {
  const data = contact.custom_data || {};
  const [name, setName] = useState(data.installateur_nom || '');
  const [phone, setPhone] = useState(data.installateur_telephone || '');
  const [date, setDate] = useState(data.installation_date || '');
  const [time, setTime] = useState(data.installation_heure || '');
  const [appointmentId, setAppointmentId] = useState(String(data.installation_rdv_id || ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const confirmed = appointments.filter(appointment => appointment.status === 'confirmed');
  const address = getBuildingAddress(data);
  const phoneField = fields.find(field => field.type === 'phone' || field.type === 'tel');
  const clientPhone = phoneField && data[phoneField.name] || data.phone || data.telephone || data.tel || data.mobile || '';

  function chooseAppointment(value) {
    const appointment = confirmed.find(item => String(item.id) === value);
    setAppointmentId(value);
    if (appointment) {
      setDate(String(appointment.date).slice(0, 10));
      setTime(appointment.start_time.slice(0, 5));
    }
  }

  async function save(andSend) {
    setMessage('');
    if (!name.trim()) return setMessage('Renseigne le nom de l’installateur.');
    const recipientPhone = installerPhone(phone);
    if (!recipientPhone) return setMessage('Renseigne le numéro WhatsApp de l’installateur avec son indicatif pays.');
    if (!date || !time) return setMessage('Choisis la date et l’heure d’installation.');
    if (appointmentId && !confirmed.some(item => String(item.id) === appointmentId)) {
      return setMessage('Ce rendez-vous n’est plus confirmé. Choisis un autre créneau.');
    }
    if (andSend && !address) return setMessage('Renseigne l’adresse du client dans ses coordonnées.');
    if (andSend && !clientPhone) return setMessage('Renseigne le téléphone du client dans ses coordonnées.');
    if (andSend && !(data.nom || data.name || data.last_name)) return setMessage('Renseigne le nom du client.');

    setBusy(true);
    try {
      await onSave({
        installateur_nom: name.trim(),
        installateur_telephone: recipientPhone,
        installation_date: date,
        installation_heure: time,
        installation_rdv_id: appointmentId || null,
      });
      setPhone(recipientPhone);
      if (andSend) {
        onSend({
          type: 'whatsapp', recipientName: name.trim(), initialPhone: recipientPhone,
          initialBody: installationMessage({ data, installerName: name.trim(), date, time, address, clientPhone }),
        });
      } else {
        setMessage('Installateur et créneau enregistrés.');
      }
    } catch (error) {
      setMessage(error.message || 'Impossible d’enregistrer l’installateur.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800';
  return (
    <section className="mb-6 border-b border-slate-100 pb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Installation</h2>
      <div className="space-y-3">
        {installers.length > 0 && (
          <label className="block text-xs text-slate-600">
            Choisir un installateur enregistré
            <select className={inputClass} value="" onChange={event => {
              const installer = installers.find(item => item.phone === event.target.value);
              if (installer) { setName(installer.name); setPhone(installer.phone); }
            }}>
              <option value="">— Choisir —</option>
              {installers.map(installer => <option key={installer.phone} value={installer.phone}>{installer.name} · {installer.phone}</option>)}
            </select>
          </label>
        )}
        <label className="block text-xs text-slate-600">
          Nom de l’installateur
          <input className={inputClass} value={name} onChange={event => setName(event.target.value)} autoComplete="off" />
        </label>
        <label className="block text-xs text-slate-600">
          Téléphone WhatsApp de l’installateur
          <input type="tel" className={inputClass} value={phone} onChange={event => setPhone(event.target.value)} placeholder="+33 6 12 34 56 78" />
        </label>
        {confirmed.length > 0 && (
          <label className="block text-xs text-slate-600">
            Reprendre un rendez-vous confirmé
            <select className={inputClass} value={appointmentId} onChange={event => chooseAppointment(event.target.value)}>
              <option value="">Créneau saisi ci-dessous</option>
              {confirmed.map(appointment => <option key={appointment.id} value={appointment.id}>{String(appointment.date).slice(0, 10)} · {appointment.start_time.slice(0, 5)} · {appointment.title || 'RDV'}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-600">
            Date d’installation
            <input type="date" className={inputClass} value={date} onChange={event => { setDate(event.target.value); setAppointmentId(''); }} />
          </label>
          <label className="block text-xs text-slate-600">
            Heure de Paris
            <input type="time" className={inputClass} value={time} onChange={event => { setTime(event.target.value); setAppointmentId(''); }} />
          </label>
        </div>
        <button type="button" disabled={busy} onClick={() => save(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> Enregistrer
        </button>
        <button type="button" disabled={busy} onClick={() => save(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
          <Send className="h-4 w-4 shrink-0" /> Envoyer les coordonnées à l’installateur
        </button>
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      </div>
    </section>
  );
}
