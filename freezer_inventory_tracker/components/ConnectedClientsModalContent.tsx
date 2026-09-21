import React, { useState, useEffect } from 'react';
import { ConnectedClientInfo, ZoneClientCounts, OperationalZone } from '../types';
import { Users, Zap, RefreshCw, Smartphone, Laptop, Monitor, Tablet, Globe, LogOut, CheckCircle2, Wifi, Shield, ArrowUpFromLine, Check, MapPin, Truck, Building2 } from 'lucide-react';

interface ConnectedClientsModalContentProps {
  currentClientId: string;
  clients: ConnectedClientInfo[];
  activeClientCount: number;
  zoneCounts?: ZoneClientCounts;
  activeZone?: OperationalZone;
  operatingMode: 'auto' | 'multi' | 'single';
  isCollaborativeMode: boolean;
  onRefresh: () => Promise<ConnectedClientInfo[]>;
  onDisconnect: (clientId: string) => Promise<boolean>;
  onForceSyncAll: () => Promise<{ success: boolean; count: number }>;
  onClose: () => void;
}

function getDeviceIcon(device: string) {
  const d = device.toLowerCase();
  if (d.includes('iphone') || d.includes('android') || d.includes('phone') || d.includes('mobile')) {
    return <Smartphone className="w-4 h-4 text-blue-400" />;
  }
  if (d.includes('ipad') || d.includes('tablet')) {
    return <Tablet className="w-4 h-4 text-purple-400" />;
  }
  if (d.includes('mac') || d.includes('laptop')) {
    return <Laptop className="w-4 h-4 text-cyan-400" />;
  }
  if (d.includes('desktop') || d.includes('windows') || d.includes('pc') || d.includes('linux')) {
    return <Monitor className="w-4 h-4 text-emerald-400" />;
  }
  return <Globe className="w-4 h-4 text-cool-gray-400" />;
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  const diff = Date.now() - timestamp;
  if (diff < 5000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export const ConnectedClientsModalContent: React.FC<ConnectedClientsModalContentProps> = ({
  currentClientId,
  clients,
  activeClientCount,
  zoneCounts,
  activeZone = 'onsite',
  operatingMode,
  isCollaborativeMode,
  onRefresh,
  onDisconnect,
  onForceSyncAll,
  onClose
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Auto-refresh on mount
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleForceSyncAll = async () => {
    setIsSyncingAll(true);
    setSyncFeedback(null);
    try {
      const res = await onForceSyncAll();
      if (res.success) {
        setSyncFeedback(`Sync command broadcasted to ${res.count} connected ${res.count === 1 ? 'device' : 'devices'}`);
        setTimeout(() => setSyncFeedback(null), 4500);
      }
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleDisconnect = async (clientId: string) => {
    setDisconnectingId(clientId);
    try {
      await onDisconnect(clientId);
    } finally {
      setDisconnectingId(null);
    }
  };

  const isMultiActive = operatingMode === 'multi' || (operatingMode === 'auto' && isCollaborativeMode);
  const totalCount = zoneCounts?.total ?? (clients.length || activeClientCount);
  const onsiteCount = zoneCounts?.onsite ?? 1;
  const offsiteCount = zoneCounts?.offsite ?? 0;

  return (
    <div className="space-y-4 text-cool-gray-200">
      {/* Top Banner / Summary */}
      <div className="p-3.5 bg-cool-gray-800/80 rounded-xl border border-cool-gray-700/70 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${
            isMultiActive
              ? 'bg-blue-950/60 border-blue-800/60 text-blue-400'
              : 'bg-cyan-950/60 border-cyan-800/60 text-cyan-400'
          }`}>
            {isMultiActive ? <Users className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-cool-gray-100">
                {totalCount} Connected {totalCount === 1 ? 'Device' : 'Devices'}
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isMultiActive
                  ? 'bg-blue-950 text-blue-300 border-blue-800/60'
                  : 'bg-cyan-950 text-cyan-300 border-cyan-800/60'
              }`}>
                {isMultiActive ? 'Live Collaborative Sync' : 'Solo User Buffering'}
              </span>
            </div>
            <p className="text-xs text-cool-gray-400 mt-1">
              {isMultiActive
                ? `Multiple active users in your active zone (${activeZone === 'offsite' ? 'Off-Site' : 'On-Site'}). Fast 1.2s synchronization keeps screens aligned.`
                : totalCount > 1
                ? `You are working solo in your zone (${activeZone === 'offsite' ? 'Off-Site' : 'On-Site'}). Other active users are segregated in other zones, so you enjoy zero-lag single-user performance.`
                : 'Only one active device connected. Local caching is active with zero background latency.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-300 hover:text-white transition cursor-pointer border border-cool-gray-650"
            title="Refresh active client sessions"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Zone Distribution Bar */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
          activeZone === 'onsite'
            ? 'bg-cyan-950/30 border-cyan-500/40'
            : 'bg-cool-gray-850 border-cool-gray-750'
        }`}>
          <div className="flex items-center gap-2">
            <Building2 className={`w-4 h-4 ${activeZone === 'onsite' ? 'text-cyan-400' : 'text-cool-gray-400'}`} />
            <div>
              <div className="text-xs font-bold text-cool-gray-200">On-Site Zone</div>
              <div className="text-[10px] text-cool-gray-400">Products, Freezers, Settings</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              onsiteCount > 1 ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50' : 'bg-cool-gray-800 text-cool-gray-300'
            }`}>
              {onsiteCount} active
            </span>
            {activeZone === 'onsite' && (
              <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">(You)</span>
            )}
          </div>
        </div>

        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
          activeZone === 'offsite'
            ? 'bg-amber-950/30 border-amber-500/40'
            : 'bg-cool-gray-850 border-cool-gray-750'
        }`}>
          <div className="flex items-center gap-2">
            <Truck className={`w-4 h-4 ${activeZone === 'offsite' ? 'text-amber-400' : 'text-cool-gray-400'}`} />
            <div>
              <div className="text-xs font-bold text-cool-gray-200">Off-Site Zone</div>
              <div className="text-[10px] text-cool-gray-400">Butcher Logs, Freight, Traceability</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              offsiteCount > 1 ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50' : 'bg-cool-gray-800 text-cool-gray-300'
            }`}>
              {offsiteCount} active
            </span>
            {activeZone === 'offsite' && (
              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">(You)</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar: Force Sync All Devices */}
      <div className="flex items-center justify-between gap-3 p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <ArrowUpFromLine className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-bold text-cool-gray-100 block truncate">Force Sync All Devices</span>
            <span className="text-[11px] text-cool-gray-400 block truncate">
              Instructs every open device/tab to flush pending cached edits immediately
            </span>
          </div>
        </div>

        <button
          onClick={handleForceSyncAll}
          disabled={isSyncingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white text-xs font-semibold shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          {isSyncingAll ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Flushing...</span>
            </>
          ) : (
            <>
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              <span>Force Sync Now</span>
            </>
          )}
        </button>
      </div>

      {/* Sync Broadcast Toast Notification */}
      {syncFeedback && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs rounded-lg animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{syncFeedback}</span>
        </div>
      )}

      {/* Connected Clients List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-cool-gray-400 px-1">
          <span>Active Connections</span>
          <span>Status & Actions</span>
        </div>

        {clients.length === 0 ? (
          <div className="p-6 text-center bg-cool-gray-850/50 rounded-xl border border-cool-gray-800 text-cool-gray-400 text-xs">
            <Wifi className="w-6 h-6 mx-auto mb-2 text-cool-gray-500 animate-pulse" />
            <p>Scanning active client connections...</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1 custom-scrollbar">
            {clients.map((client) => {
              const isCurrent = client.id === currentClientId;
              const isDisconnecting = disconnectingId === client.id;
              return (
                <div
                  key={client.id}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-cyan-950/20 border-cyan-500/40 shadow-xs ring-1 ring-cyan-500/20'
                      : 'bg-cool-gray-850/70 border-cool-gray-750 hover:border-cool-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-cool-gray-800 rounded-lg border border-cool-gray-700 shrink-0">
                      {getDeviceIcon(client.device)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-cool-gray-100 truncate">
                          {client.userName || 'User'}
                        </span>
                        {client.clientDevice && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            client.clientDevice.includes('Companion')
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800/60'
                              : client.clientDevice.includes('Mobile')
                              ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                          }`}>
                            {client.clientDevice}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-700/50">
                            This Device (You)
                          </span>
                        )}
                        {client.zone && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                            client.zone === 'offsite'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                              : 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                          }`}>
                            {client.zone === 'offsite' ? <Truck className="w-2.5 h-2.5" /> : <Building2 className="w-2.5 h-2.5" />}
                            {client.zone === 'offsite' ? 'Off-Site' : 'On-Site'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-cool-gray-400 mt-0.5">
                        <span>{client.clientInfo || `${client.device} • ${client.browser}`}</span>
                        {client.currentView && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-cool-gray-300 font-medium capitalize">
                              Viewing: {client.currentView.replace('_', ' ')}
                            </span>
                          </>
                        )}
                        {client.id && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[10px] text-cool-gray-500">
                              ID: {client.id.substring(0, 8)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1.5 text-xs text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Connected</span>
                      </div>
                      <span className="text-[10px] text-cool-gray-400 block">
                        Active {formatRelativeTime(client.lastActive || client.connectedAt)}
                      </span>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => handleDisconnect(client.id)}
                        disabled={isDisconnecting}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 border border-rose-800/40 transition cursor-pointer text-xs"
                        title="Force syncs cached edits and disconnects this session"
                      >
                        <LogOut className={`w-3.5 h-3.5 ${isDisconnecting ? 'animate-spin' : ''}`} />
                        <span className="text-[11px] hidden sm:inline">{isDisconnecting ? 'Syncing...' : 'Disconnect'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Explainer Box */}
      <div className="p-3 bg-cool-gray-850/90 rounded-xl border border-cool-gray-750 text-xs space-y-1.5 text-cool-gray-300">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-cool-gray-200 uppercase tracking-wider">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          <span>Cache Safety & Auto Sync Rules</span>
        </div>
        <p className="text-[11px] text-cool-gray-400 leading-relaxed">
          • <strong className="text-cyan-300">Pre-Prune Flush:</strong> Disconnecting or pruning a device automatically sends a targeted flush signal to push any uncommitted edits before closing.
        </p>
        <p className="text-[11px] text-cool-gray-400 leading-relaxed">
          • <strong className="text-blue-300">Force Sync All:</strong> Broadcasts a flush command to all open phones, tablets, or desktop tabs to commit their local memory queue to SQLite.
        </p>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2 border-t border-cool-gray-800">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer border border-cool-gray-650"
        >
          Close
        </button>
      </div>
    </div>
  );
};
