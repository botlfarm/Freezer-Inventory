import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react';

interface OfflineSyncBadgeProps {
  isOnline: boolean;
  offlineQueueCount: number;
  isSyncingQueue: boolean;
  lastSyncTime?: number | null;
  onManualSync?: () => void;
  className?: string;
}

export const OfflineSyncBadge: React.FC<OfflineSyncBadgeProps> = ({
  isOnline,
  offlineQueueCount,
  isSyncingQueue,
  lastSyncTime,
  onManualSync,
  className = ''
}) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const formatLastSynced = (time: number | null | undefined): string => {
    if (!time) return 'Never';
    const diff = Date.now() - time;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formattedTime = formatLastSynced(lastSyncTime);
  const tooltipText = lastSyncTime 
    ? `Last successfully synced with server: ${new Date(lastSyncTime).toLocaleString()}`
    : 'No successful sync recorded yet in this session.';

  // If online with 0 queued items and not syncing, keep header minimal
  if (isOnline && offlineQueueCount === 0 && !isSyncingQueue) {
    return null;
  }

  if (isSyncingQueue) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-medium animate-pulse ${className}`}
        title="Syncing queued offline changes with Home Assistant server..."
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
        <span>Syncing {offlineQueueCount > 0 ? `${offlineQueueCount} edits` : 'changes'}...</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <div
          onClick={onManualSync}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium cursor-pointer hover:bg-amber-500/25 transition shadow-sm ${className}`}
          title={`${offlineQueueCount > 0 ? `${offlineQueueCount} offline actions queued for auto-sync on reconnect. ` : ''}${tooltipText}`}
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Offline {offlineQueueCount > 0 && <span className="font-semibold text-amber-200">({offlineQueueCount} unsynced)</span>}
          </span>
        </div>
        <span className="text-[10px] text-cool-gray-400 font-semibold select-none whitespace-nowrap" title={tooltipText}>
          Synced {formattedTime}
        </span>
      </div>
    );
  }

  if (offlineQueueCount > 0) {
    return (
      <button
        onClick={onManualSync}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-200 text-xs font-medium hover:bg-blue-500/30 transition shadow-sm ${className}`}
        title={`Click to sync queued changes immediately. ${tooltipText}`}
      >
        <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
        <span>Sync {offlineQueueCount} pending</span>
      </button>
    );
  }

  return null;
};
