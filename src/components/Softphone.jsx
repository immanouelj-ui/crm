import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, X, Loader2, Mic, MicOff, Grid3x3, Circle, Square } from 'lucide-react';
import { api } from '../api.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function Softphone() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | registering | ready | calling | in-call | error
  const [number, setNumber] = useState('');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const statusRef = useRef('idle');
  const recordingSidRef = useRef(null);
  const numberRef = useRef('');
  const contactIdRef = useRef(null);
  const durationRef = useRef(0);
  const connectedRef = useRef(false);

  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    api.getTwilioStatus().then(s => setAvailable(!!s.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    function onCallNumber(e) {
      const num = e.detail?.number || '';
      if (!num || statusRef.current === 'calling' || statusRef.current === 'in-call') return;
      setNumber(num);
      setOpen(true);
      handleCall(num, e.detail?.contactId ?? null);
    }
    window.addEventListener('crm:call-number', onCallNumber);
    return () => window.removeEventListener('crm:call-number', onCallNumber);
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      deviceRef.current?.destroy();
    };
  }, []);

  async function ensureDevice() {
    if (deviceRef.current) return deviceRef.current;
    setStatus('registering');
    const { Device } = await import('@twilio/voice-sdk');
    const { token } = await api.getTwilioToken();
    const device = new Device(token, { codecPreferences: ['opus', 'pcmu'] });
    device.on('registered', () => setStatus('ready'));
    device.on('error', e => { setError(e.message); setStatus('error'); });
    device.on('tokenWillExpire', async () => {
      const { token: fresh } = await api.getTwilioToken();
      device.updateToken(fresh);
    });
    await device.register();
    deviceRef.current = device;
    return device;
  }

  function startTimer() {
    durationRef.current = 0;
    setDuration(0);
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }
  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function handleCall(dialNumber, contactId = null) {
    const target = dialNumber ?? number;
    if (!target) return;
    setError('');
    numberRef.current = target;
    contactIdRef.current = contactId;
    connectedRef.current = false;
    try {
      const device = await ensureDevice();
      setStatus('calling');
      const call = await device.connect({ params: { To: target } });
      callRef.current = call;
      call.on('accept', () => { connectedRef.current = true; setStatus('in-call'); startTimer(); });
      call.on('disconnect', handleHangupCleanup);
      call.on('cancel', handleHangupCleanup);
      call.on('error', e => { setError(e.message); handleHangupCleanup(); });
    } catch (e) {
      setError(e.message);
      setStatus('ready');
    }
  }

  async function logCall() {
    const wasConnected = connectedRef.current;
    const seconds = durationRef.current;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const durationLabel = `${mins}m${secs.toString().padStart(2, '0')}s`;
    const notes = wasConnected
      ? `Appel sortant vers ${numberRef.current} — durée ${durationLabel}${recordingSidRef.current ? ' — enregistré' : ''}`
      : `Appel sortant vers ${numberRef.current} — non abouti`;
    try {
      await api.createInteraction({
        contact_id: contactIdRef.current,
        type: 'appel',
        date: new Date().toISOString(),
        notes,
        phone_number: numberRef.current,
        duration_sec: wasConnected ? seconds : 0,
        recording_sid: recordingSidRef.current,
        direction: 'outbound',
      });
      if (contactIdRef.current) {
        window.dispatchEvent(new CustomEvent('crm:call-logged', { detail: { contactId: contactIdRef.current } }));
      }
    } catch {}
  }

  function handleHangupCleanup() {
    stopTimer();
    logCall();
    setStatus('ready');
    setMuted(false);
    setShowKeypad(false);
    setRecording(false);
    recordingSidRef.current = null;
    callRef.current = null;
  }

  function handleHangup() {
    callRef.current?.disconnect();
  }

  function toggleMute() {
    if (!callRef.current) return;
    const next = !muted;
    callRef.current.mute(next);
    setMuted(next);
  }

  function pressKey(digit) {
    callRef.current?.sendDigits(digit);
  }

  async function toggleRecord() {
    const callSid = callRef.current?.parameters?.CallSid;
    if (!callSid || recordingBusy) return;
    setRecordingBusy(true);
    try {
      if (!recording) {
        const { recordingSid } = await api.startCallRecording(callSid);
        recordingSidRef.current = recordingSid;
        setRecording(true);
      } else {
        await api.stopCallRecording(callSid, recordingSidRef.current);
        recordingSidRef.current = null;
        setRecording(false);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRecordingBusy(false);
    }
  }

  function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  if (!open) {
    if (!available) return null;
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors z-50"
        title="Téléphone"
      >
        <Phone className="w-5 h-5" />
      </button>
    );
  }

  const inCall = status === 'calling' || status === 'in-call';

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white cursor-move">
        <p className="text-sm font-medium">Téléphone</p>
        <button onClick={() => !inCall && setOpen(false)} className="text-white/80 hover:text-white disabled:opacity-30" disabled={inCall} title={inCall ? 'Raccrochez avant de fermer' : 'Fermer'}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
          <div className="text-center py-2">
            {status === 'in-call' ? (
              <>
                <p className="text-xs text-slate-500">En appel avec</p>
                <p className="text-lg font-semibold text-slate-900">{number}</p>
                <p className="text-sm text-emerald-600 font-mono mt-1">{fmt(duration)}</p>
                {recording && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-red-600 font-medium mt-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Enregistrement en cours
                  </p>
                )}
              </>
            ) : status === 'calling' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mx-auto mb-1" />
                <p className="text-sm text-slate-500">Appel de {number}…</p>
              </>
            ) : (
              <input
                type="tel"
                value={number}
                onChange={e => setNumber(e.target.value)}
                placeholder="+33612345678"
                disabled={status === 'registering'}
                className="w-full text-center text-base border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
            )}
          </div>

          {error && <p className="text-xs text-red-600 text-center">{error}</p>}

          {showKeypad && status === 'in-call' && (
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map(k => (
                <button
                  key={k}
                  onClick={() => pressKey(k)}
                  className="py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-base font-medium transition-colors"
                >
                  {k}
                </button>
              ))}
            </div>
          )}

          {status === 'in-call' ? (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={toggleMute}
                title={muted ? 'Réactiver le micro' : 'Couper le micro'}
                className={`flex items-center justify-center w-11 h-11 rounded-full border transition-colors ${muted ? 'bg-slate-700 border-slate-700 text-white' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleRecord}
                disabled={recordingBusy}
                title={recording ? "Arrêter l'enregistrement" : 'Enregistrer l\'appel'}
                className={`flex items-center justify-center w-11 h-11 rounded-full border transition-colors disabled:opacity-50 ${recording ? 'bg-red-50 border-red-300 text-red-600' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
              >
                {recordingBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4 fill-current" /> : <Circle className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowKeypad(k => !k)}
                title="Clavier"
                className={`flex items-center justify-center w-11 h-11 rounded-full border transition-colors ${showKeypad ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={handleHangup}
                title="Raccrocher"
                className="flex items-center justify-center w-11 h-11 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          ) : status === 'calling' ? (
            <div className="flex items-center justify-center">
              <button
                onClick={handleHangup}
                title="Annuler"
                className="flex items-center justify-center w-11 h-11 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleCall()}
              disabled={!number || status === 'registering'}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {status === 'registering' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {status === 'registering' ? 'Initialisation…' : 'Appeler'}
            </button>
          )}
        </div>
    </div>
  );
}
