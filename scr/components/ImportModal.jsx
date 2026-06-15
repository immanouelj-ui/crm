import React, { useState, useRef } from 'react';
import { api } from '../api.js';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';

export default function ImportModal({ fields, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setError('');
    setResult(null);

    Papa.parse(f, {
      header: true,
      preview: 6,
      skipEmptyLines: true,
      complete: (results) => {
        setPreview(results);
        // Auto-map columns
        const autoMap = {};
        const fieldNames = fields.map(f => f.name.toLowerCase());
        const fieldLabels = fields.map(f => f.label.toLowerCase());
        for (const col of results.meta.fields || []) {
          const lc = col.toLowerCase();
          const byName = fields.find(f => f.name.toLowerCase() === lc);
          const byLabel = fields.find(f => f.label.toLowerCase() === lc);
          if (byName) autoMap[col] = byName.name;
          else if (byLabel) autoMap[col] = byLabel.name;
          else autoMap[col] = '';
        }
        setMapping(autoMap);
      },
      error: (err) => setError(err.message),
    });
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) handleFile(f);
    else setError('Veuillez déposer un fichier CSV');
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError('');

    // Re-parse full file with current mapping
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Remap columns
        const remapped = results.data.map(row => {
          const newRow = {};
          for (const [csvCol, fieldName] of Object.entries(mapping)) {
            if (fieldName && row[csvCol] !== undefined) {
              newRow[fieldName] = row[csvCol];
            }
          }
          return newRow;
        });

        // Build CSV from remapped data
        const csvText = Papa.unparse(remapped);

        try {
          const res = await api.importCSV(csvText);
          setResult(res);
          onImported();
        } catch (e) {
          setError(e.message);
        } finally {
          setImporting(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setImporting(false);
      },
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Importer des contacts CSV</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {result ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Import réussi !</h3>
              <p className="text-gray-600">{result.imported} contact{result.imported !== 1 ? 's' : ''} importé{result.imported !== 1 ? 's' : ''}</p>
              <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  {file ? file.name : 'Glissez un fichier CSV ici ou cliquez pour sélectionner'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Format CSV uniquement</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Column mapping */}
              {preview && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Correspondance des colonnes
                  </h3>
                  <div className="space-y-2">
                    {(preview.meta.fields || []).map(col => (
                      <div key={col} className="flex items-center gap-3">
                        <div className="w-40 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-600 truncate">{col}</span>
                        </div>
                        <span className="text-gray-400">→</span>
                        <select
                          value={mapping[col] || ''}
                          onChange={e => setMapping(prev => ({ ...prev, [col]: e.target.value }))}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— Ignorer —</option>
                          {fields.map(f => (
                            <option key={f.name} value={f.name}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Preview table */}
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Aperçu (5 premières lignes)
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {(preview.meta.fields || []).map(col => (
                              <th key={col} className="text-left px-3 py-2 text-gray-500 font-medium border-r border-gray-200 last:border-r-0">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.data.slice(0, 5).map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              {(preview.meta.fields || []).map(col => (
                                <td key={col} className="px-3 py-1.5 text-gray-600 border-r border-gray-100 last:border-r-0 max-w-[120px] truncate">
                                  {row[col] || '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!result && (
          <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {importing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : <Upload className="w-4 h-4" />}
              Importer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
