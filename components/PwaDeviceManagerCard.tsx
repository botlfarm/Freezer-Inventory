// PWA device manager card component with user grouping, rich filtering, and individual & user-level revocation
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  Shield,
  RefreshCw,
  Trash2,
  Edit2,
  Ban,
  CheckCircle,
  AlertTriangle,
  User,
  Users,
  UserCheck,
  UserX,
  HardDrive,
  Info,
  Check,
  Copy,
  Zap,
  Wifi,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  SlidersHorizontal,
  Layers,
  Filter,
  ShieldAlert,
  Power
} from 'lucide-react';
import { PwaDevice } from '../types';
import {
  getDeviceId,
  getDeviceName,
  getOperatorName,
  isStandalonePWA,
  setClientDeviceInfo,
  getClientDeviceInfo,
  getClientAuditHeaders
} from '../utils/clientDevice';
import { getApiUrl } from '../hooks/apiUrl';

interface PwaDeviceManagerCardProps {
  onDeviceUpdated?: () => void;
}

interface UserDeviceGroup {
  operatorKey: string; // lowercased or '__unassigned__'
  rawOperator: string; // original operator string
  displayName: string; // e.g. "Nick" or "Unassigned / Anonymous"
  devices: PwaDevice[];
  totalCount: number;
  pwaCount: number;
  onlineCount: number;
  revokedCount: number;
  authorizedCount: number;
  allRevoked: boolean;
  allAuthorized: boolean;
  partiallyRevoked: boolean;
  hasCurrentDevice: boolean;
  lastActiveTimestamp: number;
}

type ViewMode = 'grouped' | 'flat';
type StatusFilter = 'all' | 'authorized' | 'revoked';
type PresenceFilter = 'all' | 'online' | 'offline';
type TypeFilter = 'all' | 'pwa' | 'browser';
type SortOption = 'recent' | 'user_asc' | 'name_asc' | 'devices_desc' | 'oldest';

export const PwaDeviceManagerCard: React.FC<PwaDeviceManagerCardProps> = ({ onDeviceUpdated }) => {
  // Current local device state
  const [currentDeviceId, setCurrentDeviceId] = useState<string>(getDeviceId());
  const [currentDeviceName, setCurrentDeviceName] = useState<string>(getDeviceName());
  const [currentOperatorName, setCurrentOperatorName] = useState<string>(getOperatorName());
  const [isPwa] = useState<boolean>(isStandalonePWA());

  // Edit current device state
  const [isEditingCurrentDevice, setIsEditingCurrentDevice] = useState<boolean>(false);
  const [editNameInput, setEditNameInput] = useState<string>('');
  const [editOperatorInput, setEditOperatorInput] = useState<string>('');
  const [isSavingCurrent, setIsSavingCurrent] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Registered devices state from server
  const [devices, setDevices] = useState<PwaDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);
  const [deviceActionLoadingId, setDeviceActionLoadingId] = useState<string | null>(null);
  const [isBatchActionLoading, setIsBatchActionLoading] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // View mode and filtering state
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Edit another device modal
  const [editingDevice, setEditingDevice] = useState<PwaDevice | null>(null);
  const [modalName, setModalName] = useState<string>('');
  const [modalOperator, setModalOperator] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [isSavingModal, setIsSavingModal] = useState<boolean>(false);

  // Delete device confirmation modal
  const [deviceToDelete, setDeviceToDelete] = useState<PwaDevice | null>(null);

  // User-level bulk action confirmation modals
  const [userToRevoke, setUserToRevoke] = useState<UserDeviceGroup | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserDeviceGroup | null>(null);

  // Security explainer collapsible
  const [showSecurityInfo, setShowSecurityInfo] = useState<boolean>(false);

  // Sync state when local device info changes
  useEffect(() => {
    const handleLocalDeviceUpdate = () => {
      setCurrentDeviceId(getDeviceId());
      setCurrentDeviceName(getDeviceName());
      setCurrentOperatorName(getOperatorName());
    };
    window.addEventListener('freezer_device_info_changed', handleLocalDeviceUpdate);
    return () => window.removeEventListener('freezer_device_info_changed', handleLocalDeviceUpdate);
  }, []);

  // Fetch devices from backend
  const fetchDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      const res = await fetch(getApiUrl('api/devices'), {
        headers: {
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.devices && Array.isArray(data.devices)) {
          setDevices(data.devices);
        }
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Handle saving this device's operator and device name
  const handleSaveCurrentDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingCurrent(true);
    setFeedbackMessage(null);
    try {
      const cleanOp = editOperatorInput.trim();
      const cleanDev = editNameInput.trim() || currentDeviceName;

      setClientDeviceInfo({
        operatorName: cleanOp,
        deviceName: cleanDev,
        markPrompted: true
      });

      setCurrentOperatorName(cleanOp);
      setCurrentDeviceName(cleanDev);

      // Register with backend immediately
      const clientInfo = getClientDeviceInfo();
      await fetch(getApiUrl('api/devices/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuditHeaders()
        },
        body: JSON.stringify({
          deviceId: clientInfo.deviceId,
          deviceName: cleanDev,
          operatorName: cleanOp,
          isPwa: clientInfo.isPwa,
          clientDevice: clientInfo.clientDevice,
          clientInfo: clientInfo.clientInfo
        })
      });

      setIsEditingCurrentDevice(false);
      setFeedbackMessage({
        type: 'success',
        text: `Device identity saved! Operator "${cleanOp || 'Unassigned'}" will be recorded in audit logs.`
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
      fetchDevices();
      if (onDeviceUpdated) onDeviceUpdated();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to save device identity.'
      });
    } finally {
      setIsSavingCurrent(false);
    }
  };

  // Copy Device ID
  const handleCopyId = (id: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Toggle Revoke / Authorize for a single device
  const handleToggleAuthorization = async (device: PwaDevice) => {
    const isCurrentlyRevoked = device.status === 'revoked';
    const endpoint = isCurrentlyRevoked
      ? `api/devices/${encodeURIComponent(device.id)}/authorize`
      : `api/devices/${encodeURIComponent(device.id)}/revoke`;

    setDeviceActionLoadingId(device.id);
    try {
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        setFeedbackMessage({
          type: 'success',
          text: isCurrentlyRevoked
            ? `Device "${device.name}" access restored.`
            : `Device "${device.name}" revoked. Any active session has been immediately disconnected.`
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
        fetchDevices();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update authorization.');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setDeviceActionLoadingId(null);
    }
  };

  // Revoke an entire User (all devices belonging to that user)
  const handleRevokeUser = async (userGroup: UserDeviceGroup) => {
    setIsBatchActionLoading(true);
    try {
      const rawParam = userGroup.operatorKey === '__unassigned__' ? '__unassigned__' : userGroup.rawOperator;
      const res = await fetch(getApiUrl(`api/devices/user/${encodeURIComponent(rawParam)}/revoke`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        setUserToRevoke(null);
        setFeedbackMessage({
          type: 'success',
          text: `User "${userGroup.displayName}" revoked! All ${userGroup.devices.length} device(s) have been disconnected immediately.`
        });
        setTimeout(() => setFeedbackMessage(null), 4500);
        fetchDevices();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to revoke user.');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setIsBatchActionLoading(false);
    }
  };

  // Authorize an entire User (restore all devices belonging to that user)
  const handleAuthorizeUser = async (userGroup: UserDeviceGroup) => {
    setIsBatchActionLoading(true);
    try {
      const rawParam = userGroup.operatorKey === '__unassigned__' ? '__unassigned__' : userGroup.rawOperator;
      const res = await fetch(getApiUrl(`api/devices/user/${encodeURIComponent(rawParam)}/authorize`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        setFeedbackMessage({
          type: 'success',
          text: `Access restored for all ${userGroup.devices.length} device(s) belonging to "${userGroup.displayName}".`
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
        fetchDevices();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to authorize user.');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setIsBatchActionLoading(false);
    }
  };

  // Delete all devices belonging to an entire user
  const handleDeleteUser = async (userGroup: UserDeviceGroup) => {
    setIsBatchActionLoading(true);
    try {
      const rawParam = userGroup.operatorKey === '__unassigned__' ? '__unassigned__' : userGroup.rawOperator;
      const res = await fetch(getApiUrl(`api/devices/user/${encodeURIComponent(rawParam)}`), {
        method: 'DELETE',
        headers: {
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        setUserToDelete(null);
        setFeedbackMessage({
          type: 'success',
          text: `Deleted all ${userGroup.devices.length} device records for "${userGroup.displayName}".`
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
        fetchDevices();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete user devices.');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Delete failed.' });
    } finally {
      setIsBatchActionLoading(false);
    }
  };

  // Save Modal Edits
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    setIsSavingModal(true);
    try {
      const res = await fetch(getApiUrl(`api/devices/${encodeURIComponent(editingDevice.id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuditHeaders()
        },
        body: JSON.stringify({
          name: modalName.trim() || editingDevice.name,
          operator: modalOperator.trim(),
          notes: modalNotes.trim()
        })
      });
      if (res.ok) {
        // If editing this device, also update local storage
        if (editingDevice.id === currentDeviceId) {
          setClientDeviceInfo({
            operatorName: modalOperator.trim(),
            deviceName: modalName.trim() || editingDevice.name
          });
          setCurrentOperatorName(modalOperator.trim());
          setCurrentDeviceName(modalName.trim() || editingDevice.name);
        }
        setEditingDevice(null);
        setFeedbackMessage({ type: 'success', text: 'Device settings updated successfully.' });
        setTimeout(() => setFeedbackMessage(null), 3500);
        fetchDevices();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update device.');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setIsSavingModal(false);
    }
  };

  // Delete Single Device
  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;
    setDeviceActionLoadingId(deviceToDelete.id);
    try {
      const res = await fetch(getApiUrl(`api/devices/${encodeURIComponent(deviceToDelete.id)}`), {
        method: 'DELETE',
        headers: {
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        setDeviceToDelete(null);
        setFeedbackMessage({ type: 'success', text: `Device record deleted.` });
        setTimeout(() => setFeedbackMessage(null), 3000);
        fetchDevices();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to delete device.' });
    } finally {
      setDeviceActionLoadingId(null);
    }
  };

  const formatRelativeTime = (isoString?: string): string => {
    if (!isoString) return 'Never';
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 15000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const getDeviceIcon = (clientDevice?: string, isPwaDevice?: boolean) => {
    const cd = (clientDevice || '').toLowerCase();
    if (isPwaDevice || cd.includes('pwa') || cd.includes('standalone')) {
      return <Smartphone className="w-4 h-4 text-cyan-400" />;
    }
    if (cd.includes('companion') || cd.includes('home assistant')) {
      return <Smartphone className="w-4 h-4 text-blue-400" />;
    }
    if (cd.includes('mobile') || cd.includes('iphone') || cd.includes('android')) {
      return <Smartphone className="w-4 h-4 text-purple-400" />;
    }
    if (cd.includes('tablet') || cd.includes('ipad')) {
      return <Tablet className="w-4 h-4 text-indigo-400" />;
    }
    if (cd.includes('desktop') || cd.includes('mac') || cd.includes('windows')) {
      return <Monitor className="w-4 h-4 text-emerald-400" />;
    }
    return <Globe className="w-4 h-4 text-cool-gray-400" />;
  };

  // High-level statistics
  const totalRegistered = devices.length;
  const pwaCount = devices.filter(d => d.isPwa || d.clientDevice?.includes('Standalone') || d.clientDevice?.includes('PWA')).length;
  const onlineCount = devices.filter(d => d.isOnline || d.id === currentDeviceId).length;
  const revokedCount = devices.filter(d => d.status === 'revoked').length;

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return devices.filter((device) => {
      // Search query check
      if (query) {
        const matchesName = (device.name || '').toLowerCase().includes(query);
        const matchesOp = (device.operator || '').toLowerCase().includes(query);
        const matchesId = (device.id || '').toLowerCase().includes(query);
        const matchesIp = (device.lastIp || '').toLowerCase().includes(query);
        const matchesNotes = (device.notes || '').toLowerCase().includes(query);
        const matchesInfo = (device.clientInfo || '').toLowerCase().includes(query) || (device.clientDevice || '').toLowerCase().includes(query);
        if (!matchesName && !matchesOp && !matchesId && !matchesIp && !matchesNotes && !matchesInfo) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'authorized' && device.status === 'revoked') return false;
      if (statusFilter === 'revoked' && device.status !== 'revoked') return false;

      // Presence filter
      const isDeviceOnline = device.isOnline || device.id === currentDeviceId;
      if (presenceFilter === 'online' && !isDeviceOnline) return false;
      if (presenceFilter === 'offline' && isDeviceOnline) return false;

      // Type filter
      const isStandalone = Boolean(device.isPwa || device.clientDevice?.includes('Standalone') || device.clientDevice?.includes('PWA'));
      if (typeFilter === 'pwa' && !isStandalone) return false;
      if (typeFilter === 'browser' && isStandalone) return false;

      return true;
    });
  }, [devices, searchQuery, statusFilter, presenceFilter, typeFilter, currentDeviceId]);

  // Group filtered devices by user/operator
  const userGroups = useMemo<UserDeviceGroup[]>(() => {
    const map = new Map<string, { raw: string; devices: PwaDevice[] }>();

    for (const d of filteredDevices) {
      const cleanOp = (d.operator || '').trim();
      const key = cleanOp ? cleanOp.toLowerCase() : '__unassigned__';
      if (!map.has(key)) {
        map.set(key, { raw: cleanOp, devices: [] });
      }
      map.get(key)!.devices.push(d);
    }

    const groups: UserDeviceGroup[] = Array.from(map.entries()).map(([key, value]) => {
      const groupDevices = value.devices;
      const count = groupDevices.length;
      const groupPwa = groupDevices.filter(d => d.isPwa || d.clientDevice?.includes('Standalone') || d.clientDevice?.includes('PWA')).length;
      const groupOnline = groupDevices.filter(d => d.isOnline || d.id === currentDeviceId).length;
      const groupRevoked = groupDevices.filter(d => d.status === 'revoked').length;
      const groupAuth = count - groupRevoked;
      const hasCurrent = groupDevices.some(d => d.id === currentDeviceId);

      let newestTimestamp = 0;
      for (const dev of groupDevices) {
        const t = dev.lastSeen ? new Date(dev.lastSeen).getTime() : 0;
        if (t > newestTimestamp) newestTimestamp = t;
      }

      const displayName = key === '__unassigned__'
        ? 'Unassigned / Anonymous Devices'
        : value.raw;

      return {
        operatorKey: key,
        rawOperator: value.raw,
        displayName,
        devices: groupDevices,
        totalCount: count,
        pwaCount: groupPwa,
        onlineCount: groupOnline,
        revokedCount: groupRevoked,
        authorizedCount: groupAuth,
        allRevoked: groupRevoked === count,
        allAuthorized: groupRevoked === 0,
        partiallyRevoked: groupRevoked > 0 && groupRevoked < count,
        hasCurrentDevice: hasCurrent,
        lastActiveTimestamp: newestTimestamp
      };
    });

    // Sort user groups
    groups.sort((a, b) => {
      // Keep unassigned devices at the bottom by default unless sorting specifically
      if (a.operatorKey === '__unassigned__') return 1;
      if (b.operatorKey === '__unassigned__') return -1;

      if (sortBy === 'recent') {
        return b.lastActiveTimestamp - a.lastActiveTimestamp;
      }
      if (sortBy === 'user_asc') {
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === 'name_asc') {
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === 'devices_desc') {
        return b.totalCount - a.totalCount;
      }
      if (sortBy === 'oldest') {
        return a.lastActiveTimestamp - b.lastActiveTimestamp;
      }
      return 0;
    });

    // Sort devices within each group (current device first, then newest active)
    for (const group of groups) {
      group.devices.sort((a, b) => {
        if (a.id === currentDeviceId) return -1;
        if (b.id === currentDeviceId) return 1;
        const timeA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const timeB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return timeB - timeA;
      });
    }

    return groups;
  }, [filteredDevices, sortBy, currentDeviceId]);

  // Flat devices sorted list
  const sortedFlatDevices = useMemo(() => {
    const list = [...filteredDevices];
    list.sort((a, b) => {
      if (a.id === currentDeviceId) return -1;
      if (b.id === currentDeviceId) return 1;

      if (sortBy === 'recent') {
        const timeA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const timeB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'user_asc') {
        const userA = (a.operator || '').toLowerCase();
        const userB = (b.operator || '').toLowerCase();
        return userA.localeCompare(userB);
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'oldest') {
        const timeA = a.firstSeen ? new Date(a.firstSeen).getTime() : 0;
        const timeB = b.firstSeen ? new Date(b.firstSeen).getTime() : 0;
        return timeA - timeB;
      }
      return 0;
    });
    return list;
  }, [filteredDevices, sortBy, currentDeviceId]);

  // Count of distinct users
  const distinctUsersCount = useMemo(() => {
    const set = new Set<string>();
    for (const d of devices) {
      const op = (d.operator || '').trim();
      if (op) set.add(op.toLowerCase());
    }
    return set.size;
  }, [devices]);

  // Toggle user group collapse
  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Expand all / Collapse all
  const handleExpandAll = () => {
    setCollapsedGroups({});
  };

  const handleCollapseAll = () => {
    const newCollapsed: Record<string, boolean> = {};
    for (const g of userGroups) {
      newCollapsed[g.operatorKey] = true;
    }
    setCollapsedGroups(newCollapsed);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPresenceFilter('all');
    setTypeFilter('all');
    setSortBy('recent');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || presenceFilter !== 'all' || typeFilter !== 'all' || sortBy !== 'recent';

  return (
    <div className="bg-gradient-to-br from-cool-gray-850 to-cool-gray-900 rounded-xl border border-cool-gray-750 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-750/70">
        <div>
          <h3 className="text-base font-bold text-cool-gray-100 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            PWA & Device Manager
          </h3>
          <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
            Manage all installed PWA phones, tablets, and browser sessions grouped by user. Control individual device access or revoke entire users with a single click.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
            {totalRegistered} {totalRegistered === 1 ? 'Device' : 'Devices'} • {distinctUsersCount} {distinctUsersCount === 1 ? 'User' : 'Users'}
          </span>
          <button
            type="button"
            onClick={fetchDevices}
            disabled={isLoadingDevices}
            className="p-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-300 hover:text-white transition cursor-pointer"
            title="Refresh devices list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingDevices ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade-in ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200'
            : 'bg-rose-950/80 border border-rose-800 text-rose-200'
        }`}>
          {feedbackMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Card 1: THIS DEVICE IDENTITY */}
      <div className="bg-cool-gray-950/80 rounded-xl border border-cyan-500/30 p-4 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              {isPwa ? <Zap className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-cool-gray-200">This Device</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  {isPwa ? '⚡ Installed Standalone PWA' : '🌐 Web Browser'}
                </span>
              </div>
              <span className="text-[11px] text-cool-gray-400">
                Audit trail identity configured for this physical device
              </span>
            </div>
          </div>

          {!isEditingCurrentDevice && (
            <button
              type="button"
              onClick={() => {
                setEditNameInput(currentDeviceName);
                setEditOperatorInput(currentOperatorName);
                setIsEditingCurrentDevice(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 hover:text-cyan-200 border border-cool-gray-700 text-xs font-semibold transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Identity</span>
            </button>
          )}
        </div>

        {!isEditingCurrentDevice ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-cool-gray-850">
            {/* Operator Name */}
            <div className="bg-cool-gray-900/80 p-2.5 rounded-lg border border-cool-gray-800">
              <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Assigned Operator (Audit Name)
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-cool-gray-100 font-mono">
                  {currentOperatorName ? `@${currentOperatorName}` : <span className="text-cool-gray-500 font-sans italic">Not configured</span>}
                </span>
              </div>
              <span className="text-[10px] text-cool-gray-500 mt-0.5 block">
                Stamped on all cuts, transfers, and inventory edits
              </span>
            </div>

            {/* Device Label */}
            <div className="bg-cool-gray-900/80 p-2.5 rounded-lg border border-cool-gray-800">
              <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Device Label
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold text-cool-gray-100">
                  {currentDeviceName}
                </span>
              </div>
              <span className="text-[10px] text-cool-gray-500 mt-0.5 block">
                Friendly label shown in the Device Manager
              </span>
            </div>

            {/* Device ID */}
            <div className="bg-cool-gray-900/80 p-2.5 rounded-lg border border-cool-gray-800">
              <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Hardware Device ID
              </span>
              <div className="flex items-center justify-between gap-1 mt-1">
                <span className="text-xs font-mono text-cool-gray-300 truncate select-all">
                  {currentDeviceId.substring(0, 16)}...
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyId(currentDeviceId)}
                  className="p-1 hover:text-white text-cool-gray-400 transition cursor-pointer"
                  title="Copy full Device ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-cool-gray-500 mt-0.5 block">
                Persistent unique token stored in browser
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveCurrentDevice} className="space-y-3 pt-2 border-t border-cool-gray-850">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Operator / User Name (e.g. Nick, Sarah)
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={editOperatorInput}
                  onChange={(e) => setEditOperatorInput(e.target.value)}
                  className="w-full bg-cool-gray-900 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  autoFocus
                />
                <span className="text-[10px] text-cool-gray-400 mt-0.5 block">
                  Replaces the generic "web browser" label in your activity audit log.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Device Label (e.g. Nick's iPhone, Walk-in iPad)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nick's iPhone"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="w-full bg-cool-gray-900 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <span className="text-[10px] text-cool-gray-400 mt-0.5 block">
                  Lets administrators identify this specific device.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingCurrentDevice(false)}
                className="px-3 py-1.5 text-xs text-cool-gray-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingCurrent}
                className="px-4 py-1.5 rounded-lg text-xs font-extrabold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isSavingCurrent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Device Identity</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">Total Devices</span>
            <span className="text-lg font-black text-cool-gray-100">{totalRegistered}</span>
          </div>
          <HardDrive className="w-5 h-5 text-cool-gray-500" />
        </div>

        <div className="p-3 bg-blue-950/30 rounded-xl border border-blue-800/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">Active Users</span>
            <span className="text-lg font-black text-blue-300">{distinctUsersCount}</span>
          </div>
          <Users className="w-5 h-5 text-blue-400" />
        </div>

        <div className="p-3 bg-cyan-950/30 rounded-xl border border-cyan-800/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block">Standalone PWAs</span>
            <span className="text-lg font-black text-cyan-300">{pwaCount}</span>
          </div>
          <Zap className="w-5 h-5 text-cyan-400" />
        </div>

        <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-800/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Online Now</span>
            <span className="text-lg font-black text-emerald-300">{onlineCount}</span>
          </div>
          <Wifi className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-800/40 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">Revoked</span>
            <span className="text-lg font-black text-rose-300">{revokedCount}</span>
          </div>
          <Ban className="w-5 h-5 text-rose-400" />
        </div>
      </div>

      {/* TOOLBAR: VIEW MODES, SEARCH & RICH FILTERING */}
      <div className="bg-cool-gray-950/90 rounded-xl border border-cool-gray-800 p-3.5 space-y-3">
        {/* Row 1: Search + View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cool-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by device label, user name, ID, IP address, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg pl-9 pr-8 py-1.5 text-xs text-cool-gray-100 placeholder-cool-gray-500 focus:outline-none focus:border-cyan-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cool-gray-400 hover:text-white transition cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle: Grouped by User vs Flat List */}
          <div className="flex items-center gap-1 bg-cool-gray-900 p-1 rounded-lg border border-cool-gray-800 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-cool-gray-400 hover:text-cool-gray-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Group by User</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('flat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'flat'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-cool-gray-400 hover:text-cool-gray-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>All Devices</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filter Selectors & Sort Options */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-cool-gray-850">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-cool-gray-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-cool-gray-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-cool-gray-900 text-xs font-semibold text-cool-gray-200 border border-cool-gray-750 rounded-lg px-2.5 py-1 focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="authorized">Authorized Only</option>
                <option value="revoked">Revoked Only</option>
              </select>
            </div>

            {/* Presence Filter */}
            <div className="flex items-center gap-1.5 text-xs text-cool-gray-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-cool-gray-500">Presence:</span>
              <select
                value={presenceFilter}
                onChange={(e) => setPresenceFilter(e.target.value as PresenceFilter)}
                className="bg-cool-gray-900 text-xs font-semibold text-cool-gray-200 border border-cool-gray-750 rounded-lg px-2.5 py-1 focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="all">All Presence</option>
                <option value="online">Online Now Only</option>
                <option value="offline">Offline Only</option>
              </select>
            </div>

            {/* Device Type Filter */}
            <div className="flex items-center gap-1.5 text-xs text-cool-gray-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-cool-gray-500">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="bg-cool-gray-900 text-xs font-semibold text-cool-gray-200 border border-cool-gray-750 rounded-lg px-2.5 py-1 focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="pwa">Standalone PWA Only</option>
                <option value="browser">Web Browsers Only</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-cool-gray-400">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-cool-gray-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-cool-gray-900 text-xs font-semibold text-cool-gray-200 border border-cool-gray-750 rounded-lg px-2.5 py-1 focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="recent">Recently Active</option>
                <option value="user_asc">User Name (A-Z)</option>
                <option value="name_asc">Device Name (A-Z)</option>
                <option value="devices_desc">Most Devices</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Quick Expand/Collapse & Reset filters */}
          <div className="flex items-center gap-2">
            {viewMode === 'grouped' && userGroups.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-cool-gray-400">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="hover:text-cyan-300 transition cursor-pointer"
                >
                  Expand All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="hover:text-cyan-300 transition cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded-md transition cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MATCHING RESULTS SUMMARY */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-cool-gray-300 uppercase tracking-wider flex items-center gap-2">
          {viewMode === 'grouped' ? (
            <>
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Registered Devices by User ({userGroups.length} {userGroups.length === 1 ? 'User' : 'Users'})</span>
            </>
          ) : (
            <>
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>All Registered Devices ({filteredDevices.length} {filteredDevices.length === 1 ? 'Device' : 'Devices'})</span>
            </>
          )}
        </span>

        <span className="text-[11px] text-cool-gray-500">
          Showing {filteredDevices.length} of {totalRegistered} devices
        </span>
      </div>

      {/* VIEW MODE 1: GROUPED BY USER */}
      {viewMode === 'grouped' && (
        <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
          {userGroups.length === 0 ? (
            <div className="p-8 text-center bg-cool-gray-900/50 rounded-xl border border-cool-gray-800 text-cool-gray-400 text-xs space-y-2">
              <Users className="w-8 h-8 mx-auto text-cool-gray-600" />
              <p className="font-semibold text-cool-gray-300">No matching user devices found</p>
              <p className="text-[11px] text-cool-gray-500 max-w-sm mx-auto">
                {hasActiveFilters ? 'Try adjusting your search query or filter options above.' : 'When devices connect, they will appear grouped by user name here.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 text-xs font-bold rounded-lg border border-cool-gray-700 transition cursor-pointer"
                >
                  Clear Active Filters
                </button>
              )}
            </div>
          ) : (
            userGroups.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.operatorKey]);
              const isUnassigned = group.operatorKey === '__unassigned__';

              return (
                <div
                  key={group.operatorKey}
                  className={`rounded-xl border transition overflow-hidden ${
                    group.allRevoked
                      ? 'bg-rose-950/15 border-rose-900/40'
                      : group.partiallyRevoked
                      ? 'bg-amber-950/15 border-amber-900/40'
                      : group.hasCurrentDevice
                      ? 'bg-cyan-950/15 border-cyan-800/40'
                      : 'bg-cool-gray-900/60 border-cool-gray-800'
                  }`}
                >
                  {/* USER GROUP HEADER CARD */}
                  <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cool-gray-900/90 border-b border-cool-gray-800/80">
                    {/* User Identity & Badges */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                        group.allRevoked
                          ? 'bg-rose-950 border-rose-800 text-rose-300'
                          : group.hasCurrentDevice
                          ? 'bg-cyan-950 border-cyan-700 text-cyan-300'
                          : isUnassigned
                          ? 'bg-cool-gray-800 border-cool-gray-700 text-cool-gray-400'
                          : 'bg-blue-950 border-blue-800 text-blue-300'
                      }`}>
                        {isUnassigned ? (
                          <HardDrive className="w-5 h-5 text-cool-gray-400" />
                        ) : (
                          <span>{group.displayName.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-cool-gray-100 flex items-center gap-1.5 truncate">
                            {!isUnassigned && <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                            <span>{isUnassigned ? group.displayName : `@${group.displayName}`}</span>
                          </span>

                          {group.hasCurrentDevice && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-200 border border-cyan-700/60">
                              You ({currentDeviceName})
                            </span>
                          )}

                          {/* Devices Count Badge */}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cool-gray-800 text-cool-gray-300 border border-cool-gray-700">
                            {group.totalCount} {group.totalCount === 1 ? 'Device' : 'Devices'}
                          </span>

                          {/* Standalone PWA Count */}
                          {group.pwaCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-800/60 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-purple-400" />
                              <span>{group.pwaCount} PWA</span>
                            </span>
                          )}

                          {/* Authorization Status Badge */}
                          {group.allRevoked ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                              <Ban className="w-3 h-3" />
                              <span>All Revoked</span>
                            </span>
                          ) : group.partiallyRevoked ? (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{group.revokedCount} of {group.totalCount} Revoked</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              <span>All Authorized</span>
                            </span>
                          )}
                        </div>

                        {/* Subtext info */}
                        <div className="flex items-center gap-2 text-xs text-cool-gray-400 mt-1 flex-wrap">
                          {group.onlineCount > 0 ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              {group.onlineCount} Online Now
                            </span>
                          ) : (
                            <span className="text-cool-gray-500 text-[11px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cool-gray-600" />
                              Offline • Active {formatRelativeTime(new Date(group.lastActiveTimestamp).toISOString())}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* USER-LEVEL ACTION CONTROLS */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-cool-gray-800">
                      {/* USER REVOKE / AUTHORIZE BULK ACTIONS */}
                      <div className="flex items-center gap-1.5">
                        {/* Revoke User Button (available if any devices are authorized) */}
                        {group.authorizedCount > 0 && (
                          <button
                            type="button"
                            disabled={isBatchActionLoading}
                            onClick={() => setUserToRevoke(group)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 transition cursor-pointer disabled:opacity-50"
                            title={`Revoke all ${group.authorizedCount} active device(s) for ${group.displayName}`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Revoke User</span>
                          </button>
                        )}

                        {/* Authorize User Button (available if any devices are revoked) */}
                        {group.revokedCount > 0 && (
                          <button
                            type="button"
                            disabled={isBatchActionLoading}
                            onClick={() => handleAuthorizeUser(group)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 transition cursor-pointer disabled:opacity-50"
                            title={`Restore all ${group.revokedCount} revoked device(s) for ${group.displayName}`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Authorize User</span>
                          </button>
                        )}

                        {/* Delete User Button */}
                        <button
                          type="button"
                          onClick={() => setUserToDelete(group)}
                          className="p-1.5 rounded-lg bg-cool-gray-800 hover:bg-rose-950/60 text-cool-gray-400 hover:text-rose-300 border border-cool-gray-700 hover:border-rose-800/60 transition cursor-pointer"
                          title={`Delete all ${group.totalCount} device record(s) for ${group.displayName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Expand / Collapse Button */}
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(group.operatorKey)}
                        className="p-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white border border-cool-gray-700 transition cursor-pointer ml-1"
                        title={isCollapsed ? "Expand devices" : "Collapse devices"}
                      >
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* USER'S EXPANDED DEVICES LIST */}
                  {!isCollapsed && (
                    <div className="p-3 sm:p-4 space-y-2.5 bg-cool-gray-950/40">
                      {group.devices.map((device) => {
                        const isThisDevice = device.id === currentDeviceId;
                        const isRevoked = device.status === 'revoked';
                        const isLoadingAction = deviceActionLoadingId === device.id;

                        return (
                          <div
                            key={device.id}
                            className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isRevoked
                                ? 'bg-rose-950/20 border-rose-900/50 opacity-80'
                                : isThisDevice
                                ? 'bg-cyan-950/30 border-cyan-500/40 ring-1 ring-cyan-500/20'
                                : 'bg-cool-gray-900/80 border-cool-gray-800 hover:border-cool-gray-750'
                            }`}
                          >
                            {/* Device Info */}
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                              <div className={`p-2 rounded-lg border shrink-0 ${
                                isRevoked
                                  ? 'bg-rose-950/60 border-rose-800/60 text-rose-400'
                                  : isThisDevice
                                  ? 'bg-cyan-950/60 border-cyan-800/60 text-cyan-400'
                                  : 'bg-cool-gray-800 border-cool-gray-700 text-cool-gray-300'
                              }`}>
                                {getDeviceIcon(device.clientDevice, device.isPwa)}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs sm:text-sm text-cool-gray-100 truncate">
                                    {device.name}
                                  </span>

                                  {isThisDevice && (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-200 border border-cyan-700/60">
                                      This Device (You)
                                    </span>
                                  )}

                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    device.isPwa
                                      ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                                      : 'bg-cool-gray-800 text-cool-gray-400 border-cool-gray-700'
                                  }`}>
                                    {device.clientDevice || (device.isPwa ? 'Standalone PWA' : 'Web Browser')}
                                  </span>

                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    isRevoked
                                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                                      : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                  }`}>
                                    {isRevoked ? 'Revoked' : 'Authorized'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-cool-gray-400 mt-1 flex-wrap">
                                  <span>{device.clientInfo || device.deviceType || 'Web Client'}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] text-cool-gray-500">
                                    ID: {device.id.substring(0, 8)}...
                                  </span>
                                  {device.lastIp && (
                                    <>
                                      <span>•</span>
                                      <span className="text-[10px] text-cool-gray-500 font-mono">{device.lastIp}</span>
                                    </>
                                  )}
                                  {device.notes && (
                                    <>
                                      <span>•</span>
                                      <span className="text-[10px] text-amber-400 italic font-medium">"{device.notes}"</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Presence Status & Device Specific Actions */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-cool-gray-800">
                              <div className="text-left sm:text-right">
                                <div className="flex items-center sm:justify-end gap-1.5 text-xs">
                                  {device.isOnline || isThisDevice ? (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                      <span className="text-emerald-400 font-bold text-xs">Online Now</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-cool-gray-500" />
                                      <span className="text-cool-gray-400 text-xs">Active {formatRelativeTime(device.lastSeen)}</span>
                                    </>
                                  )}
                                </div>
                                <span className="text-[10px] text-cool-gray-500 block">
                                  Added {new Date(device.firstSeen).toLocaleDateString()}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingDevice(device);
                                    setModalName(device.name);
                                    setModalOperator(device.operator || '');
                                    setModalNotes(device.notes || '');
                                  }}
                                  className="p-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white border border-cool-gray-700 transition cursor-pointer"
                                  title="Edit Device Label, Operator & Notes"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* Revoke / Authorize Specific Device Button */}
                                <button
                                  type="button"
                                  disabled={isLoadingAction}
                                  onClick={() => handleToggleAuthorization(device)}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-50 ${
                                    isRevoked
                                      ? 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-800/60'
                                      : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border-rose-800/60'
                                  }`}
                                  title={isRevoked ? "Restore Device Access" : "Revoke Device Access (Disconnects Session)"}
                                >
                                  {isLoadingAction ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : isRevoked ? (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span className="text-[11px]">Authorize</span>
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3.5 h-3.5" />
                                      <span className="text-[11px]">Revoke</span>
                                    </>
                                  )}
                                </button>

                                {/* Delete Device Button */}
                                <button
                                  type="button"
                                  onClick={() => setDeviceToDelete(device)}
                                  className="p-1.5 rounded-lg bg-cool-gray-800/60 hover:bg-rose-950/60 text-cool-gray-400 hover:text-rose-300 border border-cool-gray-750 hover:border-rose-800/60 transition cursor-pointer"
                                  title="Delete Device Registration"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: FLAT LIST OF ALL DEVICES */}
      {viewMode === 'flat' && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
          {sortedFlatDevices.length === 0 ? (
            <div className="p-8 text-center bg-cool-gray-900/50 rounded-xl border border-cool-gray-800 text-cool-gray-400 text-xs space-y-2">
              <HardDrive className="w-8 h-8 mx-auto text-cool-gray-600" />
              <p className="font-semibold text-cool-gray-300">No matching devices found</p>
              <p className="text-[11px] text-cool-gray-500 max-w-sm mx-auto">
                {hasActiveFilters ? 'Try adjusting your search query or filters above.' : 'When devices connect, they will appear in this registry.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 text-xs font-bold rounded-lg border border-cool-gray-700 transition cursor-pointer"
                >
                  Clear Active Filters
                </button>
              )}
            </div>
          ) : (
            sortedFlatDevices.map((device) => {
              const isThisDevice = device.id === currentDeviceId;
              const isRevoked = device.status === 'revoked';
              const isLoadingAction = deviceActionLoadingId === device.id;

              return (
                <div
                  key={device.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isRevoked
                      ? 'bg-rose-950/20 border-rose-900/50 opacity-80'
                      : isThisDevice
                      ? 'bg-cyan-950/25 border-cyan-500/40 ring-1 ring-cyan-500/20'
                      : 'bg-cool-gray-900/70 border-cool-gray-800 hover:border-cool-gray-750'
                  }`}
                >
                  {/* Left: Device & Operator Info */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${
                      isRevoked
                        ? 'bg-rose-950/60 border-rose-800/60 text-rose-400'
                        : isThisDevice
                        ? 'bg-cyan-950/60 border-cyan-800/60 text-cyan-400'
                        : 'bg-cool-gray-800 border-cool-gray-700 text-cool-gray-300'
                    }`}>
                      {getDeviceIcon(device.clientDevice, device.isPwa)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-cool-gray-100 truncate">
                          {device.name}
                        </span>

                        {isThisDevice && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-200 border border-cyan-700/60">
                            This Device (You)
                          </span>
                        )}

                        {device.operator && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cool-gray-800 text-cyan-300 border border-cool-gray-750 font-mono">
                            @{device.operator}
                          </span>
                        )}

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          device.isPwa
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                            : 'bg-cool-gray-800 text-cool-gray-400 border-cool-gray-700'
                        }`}>
                          {device.clientDevice || (device.isPwa ? 'Standalone PWA' : 'Web Browser')}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isRevoked
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}>
                          {isRevoked ? 'Revoked' : 'Authorized'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-cool-gray-400 mt-1 flex-wrap">
                        <span>{device.clientInfo || device.deviceType || 'Web Client'}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-cool-gray-500">
                          ID: {device.id.substring(0, 8)}...
                        </span>
                        {device.lastIp && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-cool-gray-500 font-mono">{device.lastIp}</span>
                          </>
                        )}
                        {device.notes && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-amber-400 italic font-medium">"{device.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Presence Status & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-cool-gray-800">
                    <div className="text-left sm:text-right">
                      <div className="flex items-center sm:justify-end gap-1.5 text-xs">
                        {device.isOnline || isThisDevice ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 font-bold text-xs">Online Now</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-cool-gray-500" />
                            <span className="text-cool-gray-400 text-xs">Active {formatRelativeTime(device.lastSeen)}</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-cool-gray-500 block">
                        Added {new Date(device.firstSeen).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDevice(device);
                          setModalName(device.name);
                          setModalOperator(device.operator || '');
                          setModalNotes(device.notes || '');
                        }}
                        className="p-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white border border-cool-gray-700 transition cursor-pointer"
                        title="Edit Device Label, Operator & Notes"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Revoke / Authorize Specific Device Button */}
                      <button
                        type="button"
                        disabled={isLoadingAction}
                        onClick={() => handleToggleAuthorization(device)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-50 ${
                          isRevoked
                            ? 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-800/60'
                            : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border-rose-800/60'
                        }`}
                        title={isRevoked ? "Restore Device Access" : "Revoke Access (Terminates Live Session)"}
                      >
                        {isLoadingAction ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isRevoked ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Authorize</span>
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Revoke</span>
                          </>
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeviceToDelete(device)}
                        className="p-1.5 rounded-lg bg-cool-gray-800/60 hover:bg-rose-950/60 text-cool-gray-400 hover:text-rose-300 border border-cool-gray-750 hover:border-rose-800/60 transition cursor-pointer"
                        title="Delete Device Registration"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECURITY EXPLAINER ACCORDION */}
      <div className="bg-cool-gray-950/90 rounded-xl border border-cool-gray-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSecurityInfo(!showSecurityInfo)}
          className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs font-bold text-cool-gray-200 hover:text-white transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>How Security, User Revocation & Persistent Cookies Work</span>
          </div>
          {showSecurityInfo ? <ChevronUp className="w-4 h-4 text-cool-gray-400" /> : <ChevronDown className="w-4 h-4 text-cool-gray-400" />}
        </button>

        {showSecurityInfo && (
          <div className="p-4 pt-1 text-xs text-cool-gray-300 space-y-3 border-t border-cool-gray-850 bg-cool-gray-950/50">
            <div className="space-y-1.5">
              <strong className="text-cyan-300 block">1. User-Level vs. Specific Device Revocation:</strong>
              <p className="text-cool-gray-400 leading-relaxed text-[11px]">
                You can revoke access for an individual phone/tablet (useful if a phone is lost), or click <span className="text-rose-400 font-semibold">"Revoke User"</span> to instantly disable all devices registered to that operator at once. When revoked, active server-sent event (SSE) real-time streams are severed instantly, and any further API calls are rejected with HTTP 403 Forbidden.
              </p>
            </div>

            <div className="space-y-1.5">
              <strong className="text-blue-300 block">2. Home Assistant Ingress vs. Standalone PWA Access:</strong>
              <p className="text-cool-gray-400 leading-relaxed text-[11px]">
                When accessing the app through the Home Assistant Companion App or web dashboard, Home Assistant's Ingress proxy verifies the user's active HA session on every single request. If you disable or delete a user in Home Assistant, their ingress session cookie is immediately invalidated by Home Assistant core.
              </p>
            </div>

            <div className="space-y-1.5">
              <strong className="text-purple-300 block">3. Standalone PWAs & Persistent Storage:</strong>
              <p className="text-cool-gray-400 leading-relaxed text-[11px]">
                Installed PWAs retain local storage to support offline scanning in deep walk-in freezers. The server-authoritative device registry prevents unauthorized access: even if a revoked device retains cached assets or browser storage, the backend enforces authorization on SQLite before processing any action.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: EDIT DEVICE MODAL */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 bg-cool-gray-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-cool-gray-800">
              <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                Edit Device Details
              </h4>
              <button
                type="button"
                onClick={() => setEditingDevice(null)}
                className="text-cool-gray-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Device Label
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Operator / User Name (Audit Log Attribution)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nick"
                  value={modalOperator}
                  onChange={(e) => setModalOperator(e.target.value)}
                  className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-cool-gray-400 mt-0.5 block">
                  Actions performed on this device will be logged under this user name.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Administrative Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meat cutting room tablet"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-cool-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="px-3.5 py-1.5 text-xs text-cool-gray-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingModal}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingModal ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM DELETE SINGLE DEVICE MODAL */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-50 bg-cool-gray-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-900 border border-rose-900/50 rounded-2xl max-w-sm w-full p-5 space-y-3.5 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-cool-gray-100">Delete Device Record?</h4>
            </div>
            <p className="text-xs text-cool-gray-300">
              Are you sure you want to remove <strong className="text-white">"{deviceToDelete.name}"</strong> from the device registry?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeviceToDelete(null)}
                className="px-3 py-1.5 text-xs text-cool-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDevice}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-sm"
              >
                Delete Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM REVOKE ENTIRE USER */}
      {userToRevoke && (
        <div className="fixed inset-0 z-50 bg-cool-gray-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-400 pb-2 border-b border-cool-gray-850">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-cool-gray-100">
                Revoke Access for {userToRevoke.operatorKey === '__unassigned__' ? userToRevoke.displayName : `@${userToRevoke.displayName}`}?
              </h4>
            </div>

            <p className="text-xs text-cool-gray-300 leading-relaxed">
              This will immediately revoke access for all <strong className="text-white">{userToRevoke.devices.length} registered device(s)</strong> belonging to this user:
            </p>

            <ul className="text-xs bg-cool-gray-950 p-3 rounded-lg border border-cool-gray-800 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
              {userToRevoke.devices.map(d => (
                <li key={d.id} className="flex items-center justify-between text-cool-gray-300">
                  <span className="font-semibold truncate">{d.name}</span>
                  <span className="text-[10px] text-cool-gray-500 font-mono ml-2 shrink-0">{d.clientDevice || (d.isPwa ? 'PWA' : 'Browser')}</span>
                </li>
              ))}
            </ul>

            <p className="text-[11px] text-rose-300/80 leading-relaxed">
              Any live connections will be disconnected immediately and any further requests from these devices will be rejected.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-cool-gray-850">
              <button
                type="button"
                onClick={() => setUserToRevoke(null)}
                className="px-3.5 py-1.5 text-xs text-cool-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBatchActionLoading}
                onClick={() => handleRevokeUser(userToRevoke)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isBatchActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>Revoke All {userToRevoke.devices.length} Devices</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRM DELETE ENTIRE USER */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-cool-gray-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-900 border border-rose-900/60 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-400 pb-2 border-b border-cool-gray-850">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-cool-gray-100">
                Delete All Devices for {userToDelete.operatorKey === '__unassigned__' ? userToDelete.displayName : `@${userToDelete.displayName}`}?
              </h4>
            </div>

            <p className="text-xs text-cool-gray-300 leading-relaxed">
              Are you sure you want to permanently remove all <strong className="text-white">{userToDelete.devices.length} registered device record(s)</strong> for this user from SQLite?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-cool-gray-850">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-cool-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBatchActionLoading}
                onClick={() => handleDeleteUser(userToDelete)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isBatchActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete All Records</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
