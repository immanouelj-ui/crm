import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Upload, Trash2, Download, Image, FileText, File, X, ZoomIn, AlertCircle } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isImage(mime) {
  return mime && mime.startsWith('image/');
}

function FileIcon({ mime }) {
  if (!mime) return <File className="w-5 h-5 text-slate-400" />;
  if (mime.startsWith('image/')) return <Image className="w-5 h-5 text-indigo-400" />;
  if (mime.includes('pdf') || mime.includes('text')) return <FileText className="w-5 h-5 text-red-400" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

export default function Attachments({ contactId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  async function load() {
    try {
      const rows = await api.getAttachments(contactId);
      setAttachments(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError('Impossible de charger les pièces jointes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [contactId]);

  async function handleFiles(files) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const token = localStorage.getItem('crm_token');
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append('files', file);
      }
      const res = await fetch(`/api/attachments/${contactId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      // Reload from server to get fresh list
      await load();
    } catch (e) {
      setError('Erreur upload : ' + (e.message || 'inconnu'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(att) {
    if (!window.confirm(`Supprimer "${att.original_name}" ?`)) return;
    try {
      await api.deleteAttachment(att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
    } catch (e) {
      setError('Erreur suppression');
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Upload button + drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center gap-2 text-indigo-600 text-sm">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            Envoi en cours…
          </div>
        ) : (
          <>
            <Upload className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-medium text-slate-500">Glisser-déposer ou <span className="text-indigo-600">cliquer pour ajouter</span></span>
            <span className="text-xs text-slate-400">Images, PDF, Word, Excel… (max 20 Mo)</span>
          </>
        )}
      </label>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-1">Aucune pièce jointe</p>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => {
            const url = api.getAttachmentUrl(att.filename);
            return (
              <div key={att.id} className="group flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors">
                {/* Thumbnail or icon */}
                {isImage(att.mime_type) ? (
                  <div
                    className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 cursor-zoom-in"
                    onClick={() => setLightbox(url)}
                  >
                    <img src={url} alt={att.original_name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-slate-100 flex items-center justify-center">
                    <FileIcon mime={att.mime_type} />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{att.original_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(att.size)}
                    {att.uploaded_by && ` · ${att.uploaded_by}`}
                    {att.created_at && ` · ${formatDate(att.created_at)}`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {isImage(att.mime_type) && (
                    <button
                      onClick={() => setLightbox(url)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors"
                      title="Agrandir"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  )}
                  <a
                    href={url}
                    download={att.original_name}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors"
                    title="Télécharger"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(att)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="w-7 h-7" />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
