import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, X, Loader2, Mic, MicOff } from 'lucide-react';
import { api } from '../api.js';

export default function Softphone() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | registering | ready | calling | in-call | error
  const [number, setNumber] = useState('');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const statusRef = useRef('idle');

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
      handleCall(num);
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
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }
  function stopTimer() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function handleCall(dialNumber) {
    const target = dialNumber ?? number;
    if (!target) return;
    setError('');
    try {
      const device = await ensureDevice();
      setStatus('calling');
      const call = await device.connect({ params: { To: target } });
      callRef.current = call;
      call.on('accept', () => { setStatus('in-call'); startTimer(); });
      call.on('disconnect', handleHangupCleanup);
      call.on('cancel', handleHangupCleanup);
      call.on('error', e => { setError(e.message); handleHangupCleanup(); });
    } catch (e) {
      setError(e.message);
      setStatus('ready');
    }
  }

  function handleHangupCleanup() {
    stopTimer();
    setStatus('ready');
    setMuted(false);
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

  function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  if (!available) return null;

  if (!open) {
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
    <div className="fixed bottom-6 right-6 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
        <p className="text-sm font-medium">Téléphone</p>
        <button onClick={() => !inCall && setOpen(false)} className="text-white/80 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {status === 'in-call' ? (
          <div className="text-center py-2">
            <p className="text-sm text-slate-500">En appel avec</p>
            <p className="text-lg font-semibold text-slate-900">{number}</p>
            <p className="text-sm text-emerald-600 font-mono mt-1">{fmt(duration)}</p>
          </div>
        ) : status === 'calling' ? (
          <div className="text-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mx-auto mb-1" />
            <p className="text-sm text-slate-500">Appel de {number}…</p>
          </div>
        ) : (
          <input
            type="tel"
            value={number}
            onChange={e => setNumber(e.target.value)}
            placeholder="+33612345678"
            disabled={status === 'registering'}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          {inCall ? (
            <>
              {status === 'in-call' && (
                <button
                  onClick={toggleMute}
                  className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${muted ? 'bg-slate-200 border-slate-300' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  {muted ? <MicOff className="w-4 h-4 text-slate-600" /> : <Mic className="w-4 h-4 text-slate-600" />}
                </button>
              )}
              <button
                onClick={handleHangup}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
                Raccrocher
              </button>
            </>
          ) : (
            <button
              onClick={() => handleCall()}
              disabled={!number || status === 'registering'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {status === 'registering' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {status === 'registering' ? 'Initialisation…' : 'Appeler'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
