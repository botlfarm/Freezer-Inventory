import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  FileJson,
  HardDriveDownload,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { FailsafeSnapshotItem, FailsafeStatus } from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { authFetch, setSessionToken } from '../utils/clientDevice';

interface FailsafeRecoveryScreenProps {
  initialStatus?: FailsafeStatus | null;
  onContinueToApp?: () => void;
  onRestored?: () => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(blob);
  });
}

export const FailsafeRecoveryScreen: React.FC<FailsafeRecoveryScreenProps> = ({
  initialStatus = null,
  onContinueToApp,
  onRestored,
}) => {
  const [status, setStatus] = useState<FailsafeStatus | null>(initialStatus);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(!initialStatus);
  const [pinInput, setPinInput] = useState<string>('');
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [pendingRestoreFilename, setPendingRestoreFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await authFetch(getApiUrl('api/failsafe/status'), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
      if (!res.ok) {
        throw new Error(`Status check failed (HTTP ${res.status}).`);
      }
      const data: FailsafeStatus = await res.json();
      setStatus(data);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to reach server failsafe status endpoint.' });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/failsafe/unlock'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to unlock failsafe recovery.');
      }
      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
      }
      setPinInput('');
      setFeedback({ type: 'success', text: 'Failsafe recovery console unlocked.' });
      await loadStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Recovery PIN rejected.' });
    } finally {
      setUnlocking(false);
    }
  };

  const executeRestore = async (filename: string) => {
    setPendingRestoreFilename(null);
    setRestoringFilename(filename);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl(`api/failsafe/restore/${encodeURIComponent(filename)}`), {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to restore snapshot.');
      }
      const safetyNote = data.safetyBackup ? ` Pre-restore copy saved as ${data.safetyBackup}.` : '';
      setFeedback({
        type: 'success',
        text: `${data.message || 'Database restored successfully.'}${safetyNote}`,
      });
      await loadStatus();
      if (onRestored) {
        onRestored();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Restore failed.' });
    } finally {
      setRestoringFilename(null);
    }
  };

  const handleDownloadSnapshot = async (filename: string) => {
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl(`api/failsafe/download/${encodeURIComponent(filename)}`), {
        method: 'GET',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download snapshot.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Download failed.' });
    }
  };

  const handleUploadAndRestoreFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['db', 'zip', 'json'].includes(ext)) {
      setFeedback({ type: 'error', text: 'Select a .db, .zip, or .json backup file to restore.' });
      return;
    }

    setUploading(true);
    setFeedback(null);
    setUploadStatusText(`Preparing "${file.name}"...`);

    try {
      const CHUNK_SIZE = 2 * 1024 * 1024;
      let savedFilename = file.name;

      if (file.size <= CHUNK_SIZE) {
        setUploadStatusText(`Uploading "${file.name}" (${formatBytes(file.size)})...`);
        const base64 = await fileToBase64(file);
        const res = await authFetch(getApiUrl('api/failsafe/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed.');
        }
        savedFilename = data.filename || file.name;
      } else {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = `fs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        for (let c = 0; c < totalChunks; c++) {
          const start = c * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          setUploadStatusText(`Uploading part ${c + 1} of ${totalChunks}...`);
          const base64 = await fileToBase64(file.slice(start, end));
          const res = await authFetch(getApiUrl('api/failsafe/upload-chunk'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uploadId,
              chunkIndex: c,
              totalChunks,
              filename: file.name,
              base64,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `Chunk upload failed at part ${c + 1}.`);
          }
          if (data.filename) savedFilename = data.filename;
        }
      }

      setUploadStatusText(`Restoring "${savedFilename}"...`);
      setPendingRestoreFilename(savedFilename);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Upload failed.' });
    } finally {
      setUploading(false);
      setUploadStatusText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadStatus();
    }
  };

  const snapshots: FailsafeSnapshotItem[] = status?.snapshots || [];
  const restorableSnapshots = snapshots.filter((s) => s.type === 'sqlite' || s.type === 'zip' || s.type === 'json');

  return (
    <div
      id="failsafe-recovery-screen"
      className="min-h-screen bg-cool-gray-950 text-cool-gray-200 px-4 py-8 flex flex-col items-center"
    >
      <div className="w-full max-w-3xl space-y-5">
        {/* Header Card */}
        <div className="bg-cool-gray-900 border border-cool-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Last-Resort Backup &amp; Recovery
                </h1>
                <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
                  Failsafe recovery console that reads snapshots directly from disk so you can restore a working database even when the main database cannot load.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {status?.dbHealthy && onContinueToApp && (
                <button
                  type="button"
                  onClick={onContinueToApp}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Open App
                </button>
              )}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3.5 py-2 rounded-xl bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload
              </button>
            </div>
          </div>

          {/* Health & Config Badges */}
          {loadingStatus && !status ? (
            <div className="flex items-center gap-2 text-xs text-cool-gray-400 pt-1">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Inspecting database health and backup vault...</span>
            </div>
          ) : status ? (
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span
                  className={`px-2.5 py-1 rounded-lg border ${
                    status.dbHealthy
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                  }`}
                >
                  {status.dbHealthy ? 'Database Healthy' : 'Database Failed to Load'}
                </span>
                {status.backupRecoveryMode && (
                  <span className="px-2.5 py-1 rounded-lg border bg-amber-950/60 border-amber-700/60 text-amber-300">
                    HA backup_recovery_mode Enabled
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg border bg-cool-gray-950 border-cool-gray-800 text-cool-gray-300 font-mono">
                  {status.snapshotsCount} Snapshot{status.snapshotsCount === 1 ? '' : 's'} on File
                </span>
              </div>

              {status.dbError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-bold text-rose-100">Database Initialization Error</div>
                    <div className="font-mono text-[11px] break-all text-rose-300 mt-0.5">{status.dbError}</div>
                  </div>
                </div>
              )}

              {status.backupRecoveryMode && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-200/90 leading-relaxed">
                  <strong>Home Assistant Failsafe Active:</strong> Once you finish restoring a snapshot, set{' '}
                  <code className="font-mono bg-amber-950 px-1 py-0.5 rounded text-amber-100">backup_recovery_mode: false</code>{' '}
                  in your Home Assistant Add-on Configuration and restart so normal app boot resumes.
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Status Feedback Toast */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                : 'bg-rose-950/50 border-rose-700/60 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{feedback.text}</span>
          </div>
        )}

        {/* Inline Restore Confirmation Banner */}
        {pendingRestoreFilename && (
          <div className="bg-amber-950/50 border border-amber-500/60 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white">Confirm Full Database Restore</h2>
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  Restore <strong className="font-mono text-white">{pendingRestoreFilename}</strong>? This replaces the active database (and photos if restoring a full <code className="font-mono">.zip</code>). A pre-restore safety copy of your current file will be saved first if readable.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRestoreFilename(null)}
                className="px-3.5 py-2 rounded-xl bg-cool-gray-850 hover:bg-cool-gray-800 text-cool-gray-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeRestore(pendingRestoreFilename)}
                disabled={Boolean(restoringFilename)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Yes, Restore Snapshot
              </button>
            </div>
          </div>
        )}

        {/* Auth Gate when PIN-protected */}
        {status && !status.authorized && (
          <div className="bg-cool-gray-900 border border-cool-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">Recovery Unlock Required</h2>
            </div>

            {status.recoveryPinConfigured && (status.backupRecoveryMode || status.adminRecoveryMode || !status.dbHealthy) ? (
              <form onSubmit={handleUnlock} className="space-y-3">
                <p className="text-xs text-cool-gray-400 leading-relaxed">
                  Enter the <code className="font-mono text-cool-gray-200">admin_recovery_pin</code> configured in your Home Assistant Add-on Configuration to view snapshots and upload/restore a backup.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Enter admin_recovery_pin"
                    className="flex-1 bg-cool-gray-950 border border-cool-gray-750 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-500 outline-none"
                    required
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={unlocking}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {unlocking ? 'Unlocking...' : 'Unlock Failsafe Console'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-cool-gray-400 leading-relaxed">
                To unlock this console when the database is healthy, either sign in as an Administrator or enable{' '}
                <code className="font-mono text-cool-gray-200">backup_recovery_mode: true</code> in Home Assistant Add-on Configuration.
              </p>
            )}
          </div>
        )}

        {/* Authorized Recovery Tools */}
        {status?.authorized && (
          <>
            {/* Upload & Restore Card */}
            <div className="bg-cool-gray-900 border border-cool-gray-800 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Upload &amp; Restore a Backup File
                </h2>
              </div>
              <p className="text-xs text-cool-gray-400 leading-relaxed">
                Upload a saved <code className="font-mono text-cool-gray-200">.db</code>, full{' '}
                <code className="font-mono text-cool-gray-200">.zip</code> package, or{' '}
                <code className="font-mono text-cool-gray-200">.json</code> backup from your device to restore everything in one step.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-cool-gray-700 bg-cool-gray-950 hover:border-cyan-500/70 hover:bg-cool-gray-900 text-xs font-bold text-cool-gray-200 transition cursor-pointer">
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>{uploadStatusText || 'Uploading...'}</span>
                    </>
                  ) : (
                    <>
                      <HardDriveDownload className="w-4 h-4 text-cyan-400" />
                      <span>Choose .db, .zip, or .json Backup File</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".db,.zip,.json"
                    disabled={uploading || Boolean(restoringFilename)}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadAndRestoreFile(f);
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Snapshots on File Card */}
            <div className="bg-cool-gray-900 border border-cool-gray-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-cool-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Snapshots on File ({restorableSnapshots.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  disabled={loadingStatus}
                  className="px-2.5 py-1 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-750 text-cool-gray-300 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {restorableSnapshots.length === 0 ? (
                <div className="text-center py-8 text-xs text-cool-gray-500 bg-cool-gray-950/60 border border-cool-gray-800 rounded-xl">
                  No <code className="font-mono">.db</code>, <code className="font-mono">.zip</code>, or{' '}
                  <code className="font-mono">.json</code> snapshots were found in the backups folder. Upload a backup file above to restore.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {restorableSnapshots.map((snap) => {
                    const isRestoringThis = restoringFilename === snap.filename;
                    return (
                      <div
                        key={snap.filename}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-cool-gray-950 border border-cool-gray-800"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {snap.type === 'zip' ? (
                              <FileArchive className="w-4 h-4 text-cyan-400 shrink-0" />
                            ) : snap.type === 'json' ? (
                              <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Database className="w-4 h-4 text-indigo-400 shrink-0" />
                            )}
                            <span className="font-mono text-xs font-bold text-white truncate" title={snap.filename}>
                              {snap.filename}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-cool-gray-850 border border-cool-gray-750 text-cool-gray-300">
                              {snap.type === 'sqlite' ? 'SQLite .db' : snap.type.toUpperCase()}
                            </span>
                            {snap.isAutomatic && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-950/70 border border-indigo-800/60 text-indigo-300">
                                Auto
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-cool-gray-450">
                            {new Date(snap.modifiedAt).toLocaleString()} &bull; {formatBytes(snap.size)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => void handleDownloadSnapshot(snap.filename)}
                            className="px-3 py-1.5 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-200 text-xs font-bold cursor-pointer flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(restoringFilename) || uploading}
                            onClick={() => setPendingRestoreFilename(snap.filename)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer flex items-center gap-1"
                          >
                            {isRestoringThis ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Restoring...
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
