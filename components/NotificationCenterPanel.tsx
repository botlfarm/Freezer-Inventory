import React, { useEffect, useMemo, useState } from 'react';
import {
  Action,
  CustomList,
  InventoryState,
  NotificationChannel,
  NotificationChannelType,
  NotificationLog,
  NotificationSettings,
} from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { authFetch } from '../utils/clientDevice';
import {
  NOTIFICATION_CHANNEL_TYPE_META,
  formatListNotificationSummary,
  getChannelTargetSummary,
  getChannelTypeLabel,
  resolveEffectiveDailyDigestMode,
} from '../utils/notifications';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  Globe,
  History,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';

export type NotificationCenterSubTab = 'channels' | 'schedules' | 'logs';

interface NotificationCenterPanelProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  activeSubTab?: NotificationCenterSubTab;
  onSubTabChange?: (tab: NotificationCenterSubTab) => void;
  hideInternalHeader?: boolean;
  createChannelRequestCount?: number;
}

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (America/New_York)' },
  { value: 'America/Chicago', label: 'Central Time (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (America/Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Pacific/Honolulu)' },
  { value: 'Europe/London', label: 'London / GMT (Europe/London)' },
  { value: 'Europe/Paris', label: 'Central Europe (Europe/Paris)' },
  { value: 'Europe/Athens', label: 'Eastern Europe (Europe/Athens)' },
  { value: 'Asia/Tokyo', label: 'Japan (Asia/Tokyo)' },
  { value: 'Asia/Sydney', label: 'Sydney (Australia/Sydney)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

function getEventSourceLabel(source?: string): string {
  switch (source) {
    case 'daily_digest_combined':
      return 'Daily Digest (Combined)';
    case 'daily_digest_separate':
      return 'Daily Digest (Separate)';
    case 'custom_schedule':
      return 'Custom Schedule';
    case 'immediate_item_added':
      return 'Immediate · Item Added';
    case 'immediate_threshold':
    case 'immediate_threshold_breach':
      return 'Immediate · Threshold Alert';
    case 'test_channel':
      return 'Channel Test';
    case 'pin_reset':
      return 'PIN Reset';
    case 'system_alert':
      return 'System Alert';
    case 'manual_trigger':
    case 'manual_send_now':
      return 'Manual Trigger';
    default:
      return source || 'Notification';
  }
}

export const NotificationCenterPanel: React.FC<NotificationCenterPanelProps> = ({
  state,
  activeSubTab,
  onSubTabChange,
  hideInternalHeader = false,
  createChannelRequestCount = 0,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<NotificationCenterSubTab>('channels');
  const currentSubTab = activeSubTab ?? internalSubTab;
  const setCurrentSubTab = (tab: NotificationCenterSubTab) => {
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      setInternalSubTab(tab);
    }
  };

  const [channels, setChannels] = useState<NotificationChannel[]>(state.notificationChannels || []);
  const [isLoading, setIsLoading] = useState(true);

  // Global schedule & routing settings
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestTime, setDigestTime] = useState('20:00');
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  });
  const [defaultChannelIds, setDefaultChannelIds] = useState<string[]>([]);
  const [loadedSettings, setLoadedSettings] = useState<NotificationSettings | null>(null);

  // Feedback & busy states
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTriggeringDigest, setIsTriggeringDigest] = useState(false);
  const [triggeringListId, setTriggeringListId] = useState<string | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);

  // Channel add/edit modal state
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<NotificationChannelType>('smtp_email');
  const [channelEnabled, setChannelEnabled] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTo, setSmtpTo] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [isTestingModalChannel, setIsTestingModalChannel] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Delete & clear confirmations (in-app modals, never window.confirm)
  const [channelToDelete, setChannelToDelete] = useState<NotificationChannel | null>(null);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);

  // Log filters
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [logChannelFilter, setLogChannelFilter] = useState<string>('all');

  // Keep channels synced when SSE updates state
  useEffect(() => {
    if (Array.isArray(state.notificationChannels) && state.notificationChannels.length > 0) {
      setChannels(state.notificationChannels);
    }
  }, [state.notificationChannels]);

  useEffect(() => {
    let mounted = true;
    authFetch(getApiUrl('api/notifications/config'))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        const settings: NotificationSettings = data?.settings || {};
        const serverChannels: NotificationChannel[] = Array.isArray(data?.channels)
          ? data.channels
          : state.notificationChannels || [];

        setChannels(serverChannels);
        setLoadedSettings(settings);
        setDigestEnabled(Boolean(settings.digestEnabled));
        setDigestTime(settings.digestTime || '20:00');
        if (settings.timezone) setTimezone(settings.timezone);
        setDefaultChannelIds(Array.isArray(settings.defaultChannelIds) ? settings.defaultChannelIds : []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load notification configuration:', err);
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const resetChannelModal = () => {
    setEditingChannelId(null);
    setChannelName('');
    setChannelType('smtp_email');
    setChannelEnabled(true);
    setSmtpHost('');
    setSmtpPort(587);
    setSmtpUser('');
    setSmtpPass('');
    setSmtpFrom('');
    setSmtpTo('');
    setSmtpSecure(false);
    setWebhookUrl('');
    setModalTestResult(null);
  };

  const openCreateChannelModal = () => {
    resetChannelModal();
    setIsChannelModalOpen(true);
  };

  const lastCreateReqRef = React.useRef(createChannelRequestCount);
  useEffect(() => {
    if (createChannelRequestCount > lastCreateReqRef.current) {
      lastCreateReqRef.current = createChannelRequestCount;
      openCreateChannelModal();
    }
  }, [createChannelRequestCount]);

  const openEditChannelModal = (channel: NotificationChannel) => {
    setEditingChannelId(channel.id);
    setChannelName(channel.name || '');
    setChannelType(channel.type || 'smtp_email');
    setChannelEnabled(channel.enabled !== false);
    setSmtpHost(channel.config?.smtpHost || '');
    setSmtpPort(Number(channel.config?.smtpPort) || 587);
    setSmtpUser(channel.config?.smtpUser || '');
    setSmtpPass(channel.config?.smtpPass || '');
    setSmtpFrom(channel.config?.smtpFrom || '');
    setSmtpTo(channel.config?.smtpTo || '');
    setSmtpSecure(Boolean(channel.config?.smtpSecure));
    setWebhookUrl(channel.config?.webhookUrl || '');
    setModalTestResult(null);
    setIsChannelModalOpen(true);
  };

  const buildChannelPayload = (): Partial<NotificationChannel> => ({
    id: editingChannelId || undefined,
    name: channelName.trim() || getChannelTypeLabel(channelType),
    type: channelType,
    enabled: channelEnabled,
    config:
      channelType === 'smtp_email'
        ? {
            smtpHost: smtpHost.trim(),
            smtpPort: Number(smtpPort) || 587,
            smtpUser: smtpUser.trim(),
            smtpPass,
            smtpFrom: smtpFrom.trim(),
            smtpTo: smtpTo.trim(),
            smtpSecure,
          }
        : channelType === 'webhook'
          ? {
              webhookUrl: webhookUrl.trim(),
            }
          : {},
  });

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingChannel(true);
    setModalTestResult(null);
    setFeedback(null);

    try {
      const payload = buildChannelPayload();
      const res = await authFetch(getApiUrl('api/notifications/channels'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalTestResult({ success: false, message: data.error || 'Failed to save channel.' });
      } else {
        setChannels(data.channels || []);
        setIsChannelModalOpen(false);
        resetChannelModal();
        setFeedback({
          success: true,
          message: `Channel "${data.channel?.name || payload.name}" saved.`,
        });
      }
    } catch (err: any) {
      setModalTestResult({ success: false, message: err.message || 'Network error while saving.' });
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleTestModalChannel = async () => {
    setIsTestingModalChannel(true);
    setModalTestResult(null);

    try {
      const payload = buildChannelPayload();
      const res = await authFetch(getApiUrl('api/notifications/test-channel'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: payload }),
      });
      const data = await res.json();
      if (data.success) {
        setModalTestResult({
          success: true,
          message: 'Test notification delivered successfully.',
        });
      } else {
        setModalTestResult({
          success: false,
          message: data.error || 'Channel test failed. Verify connection details.',
        });
      }
    } catch (err: any) {
      setModalTestResult({ success: false, message: err.message || 'Network error while testing.' });
    } finally {
      setIsTestingModalChannel(false);
    }
  };

  const handleTestSavedChannel = async (channel: NotificationChannel) => {
    setTestingChannelId(channel.id);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/notifications/test-channel'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channel.id }),
      });
      const data = await res.json();
      if (data.channels) setChannels(data.channels);
      if (data.success) {
        setFeedback({
          success: true,
          message: `Test notification sent via "${channel.name}".`,
        });
      } else {
        setFeedback({
          success: false,
          message: `Test failed for "${channel.name}": ${data.error || 'Unknown error'}`,
        });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error while testing.' });
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleToggleChannelEnabled = async (channel: NotificationChannel) => {
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/notifications/channels'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: {
            ...channel,
            enabled: !channel.enabled,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels || []);
        setFeedback({
          success: true,
          message: `Channel "${channel.name}" ${!channel.enabled ? 'enabled' : 'paused'}.`,
        });
      } else {
        setFeedback({ success: false, message: data.error || 'Could not update channel.' });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error updating channel.' });
    }
  };

  const handleConfirmDeleteChannel = async () => {
    if (!channelToDelete) return;
    const target = channelToDelete;
    setChannelToDelete(null);
    setFeedback(null);

    try {
      const res = await authFetch(getApiUrl(`api/notifications/channels/${encodeURIComponent(target.id)}`), {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels || []);
        setDefaultChannelIds((prev) => prev.filter((id) => id !== target.id));
        setFeedback({ success: true, message: `Channel "${target.name}" deleted.` });
      } else {
        setFeedback({ success: false, message: data.error || 'Failed to delete channel.' });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error deleting channel.' });
    }
  };

  const handleSaveSchedulesAndRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setFeedback(null);

    const nextSettings: NotificationSettings = {
      ...(loadedSettings || {
        id: 'global',
        digestMode: 'combined',
        method: 'in_app',
      }),
      id: 'global',
      digestEnabled,
      digestTime,
      timezone,
      defaultChannelIds,
    };

    try {
      const res = await authFetch(getApiUrl('api/notifications/save-settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: nextSettings }),
      });
      const data = await res.json();
      if (data.success) {
        setLoadedSettings(data.settings || nextSettings);
        setFeedback({ success: true, message: 'Digest and schedule settings saved.' });
      } else {
        setFeedback({ success: false, message: data.error || 'Failed to save configuration.' });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error while saving.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTriggerDailyDigestNow = async () => {
    setIsTriggeringDigest(true);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/notifications/trigger-now'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listIds: null, mode: 'digest' }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          success: true,
          message: `Daily digest run completed. ${data.messagesSent || 0} delivery attempt${data.messagesSent === 1 ? '' : 's'} dispatched.`,
        });
      } else {
        setFeedback({ success: false, message: data.error || 'Failed to dispatch daily digest.' });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error triggering digest.' });
    } finally {
      setIsTriggeringDigest(false);
    }
  };

  const handleTriggerSingleListNow = async (list: CustomList) => {
    setTriggeringListId(list.id);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/notifications/trigger-now'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listIds: [list.id], mode: 'list' }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          success: true,
          message: `Sent "${list.name}" notification (${data.messagesSent || 0} delivery attempt${data.messagesSent === 1 ? '' : 's'}).`,
        });
      } else {
        setFeedback({ success: false, message: data.error || `Failed to send "${list.name}".` });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error triggering list.' });
    } finally {
      setTriggeringListId(null);
    }
  };

  const handleClearLogs = async () => {
    setConfirmClearLogs(false);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/notifications/clear-logs'), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setFeedback({ success: true, message: 'Notification delivery logs cleared.' });
      } else {
        setFeedback({ success: false, message: data.error || 'Failed to clear logs.' });
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.message || 'Network error clearing logs.' });
    }
  };

  const toggleIdInList = (id: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const logs: NotificationLog[] = state.notificationLogs || [];
  const customLists: CustomList[] = state.customLists || [];
  const enabledLists = useMemo(() => customLists.filter((l) => l.notificationEnabled), [customLists]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return logs.filter((log) => {
      if (logStatusFilter !== 'all' && log.status !== logStatusFilter) return false;
      if (logChannelFilter !== 'all' && log.channelId !== logChannelFilter && log.method !== logChannelFilter) {
        return false;
      }
      if (q) {
        const hit =
          (log.title || '').toLowerCase().includes(q) ||
          (log.message || '').toLowerCase().includes(q) ||
          (log.channelName || '').toLowerCase().includes(q) ||
          (log.listName || '').toLowerCase().includes(q) ||
          (log.error || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [logs, logSearch, logStatusFilter, logChannelFilter]);

  if (isLoading) {
    return (
      <div className="bg-cool-gray-850 p-8 border border-cool-gray-750 rounded-xl text-center text-cool-gray-400">
        <RefreshCw className="w-7 h-7 animate-spin mx-auto text-cyan-400 mb-2" />
        <span className="font-semibold text-xs">Loading notification configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-sm text-cool-gray-200 pb-8">
      {!hideInternalHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-750">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
            <button
              type="button"
              onClick={() => setCurrentSubTab('channels')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                currentSubTab === 'channels'
                  ? 'bg-cyan-600 text-white'
                  : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
              }`}
            >
              Channels ({channels.length})
            </button>
            <button
              type="button"
              onClick={() => setCurrentSubTab('schedules')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                currentSubTab === 'schedules'
                  ? 'bg-cyan-600 text-white'
                  : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
              }`}
            >
              Digest &amp; Schedules
            </button>
            <button
              type="button"
              onClick={() => setCurrentSubTab('logs')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                currentSubTab === 'logs'
                  ? 'bg-cyan-600 text-white'
                  : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
              }`}
            >
              Delivery Logs ({logs.length})
            </button>
          </div>

          {currentSubTab === 'channels' && (
            <button
              type="button"
              onClick={openCreateChannelModal}
              className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" /> Add Channel
            </button>
          )}
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            feedback.success
              ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-300'
              : 'bg-rose-950/25 border-rose-500/35 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-cool-gray-400 hover:text-white cursor-pointer"
            aria-label="Dismiss feedback"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SUB-TAB 1: CHANNELS */}
      {currentSubTab === 'channels' && (
        <div className="space-y-4">
          <div className="bg-cool-gray-850/75 border border-cool-gray-750 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Configured Delivery Channels</h3>
              <p className="text-xs text-cool-gray-400">
                Set up named SMTP email connections, webhook endpoints, and app log channels once, then assign one or more channels per list or system workflow.
              </p>
            </div>
            <div className="text-xs text-cool-gray-400 font-medium tabular-nums whitespace-nowrap shrink-0">
              {channels.filter((c) => c.enabled).length} Active · {channels.length} Total
            </div>
          </div>

          {channels.length === 0 ? (
            <div className="bg-cool-gray-850/60 border border-cool-gray-750 rounded-xl p-10 text-center space-y-3">
              <Bell className="w-8 h-8 text-cool-gray-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">No Delivery Channels Configured</h3>
                <p className="text-xs text-cool-gray-400 max-w-md mx-auto">
                  Add an SMTP email server, webhook endpoint, or in-app log channel to start routing list notifications and system alerts.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateChannelModal}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add First Channel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {channels.map((channel) => {
                const TypeIcon =
                  channel.type === 'smtp_email'
                    ? Mail
                    : channel.type === 'webhook'
                      ? Globe
                      : FileText;
                const isTestingThis = testingChannelId === channel.id;

                return (
                  <div
                    key={channel.id}
                    className="bg-cool-gray-850/75 border border-cool-gray-750 hover:border-cool-gray-650 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <TypeIcon
                          className={`w-4 h-4 shrink-0 ${
                            channel.type === 'smtp_email'
                              ? 'text-cyan-400'
                              : channel.type === 'webhook'
                                ? 'text-purple-400'
                                : 'text-cool-gray-400'
                          }`}
                        />
                        <h4 className="text-sm font-bold text-white truncate">{channel.name}</h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-cool-gray-400">
                        <span className="font-semibold text-cool-gray-300">
                          {getChannelTypeLabel(channel.type)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={channel.enabled ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                          {channel.enabled ? 'Enabled' : 'Paused'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] truncate max-w-md">
                          {getChannelTargetSummary(channel)}
                        </span>
                      </div>

                      {channel.lastTestedAt && (
                        <div className="text-[11px] text-cool-gray-500 tabular-nums">
                          Last tested {new Date(channel.lastTestedAt).toLocaleString()} ·{' '}
                          <span
                            className={
                              channel.lastTestStatus === 'success'
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {channel.lastTestStatus === 'success' ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        disabled={isTestingThis}
                        onClick={() => handleTestSavedChannel(channel)}
                        className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-cyan-400 ${isTestingThis ? 'animate-spin' : ''}`}
                        />
                        {isTestingThis ? 'Testing...' : 'Test'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleChannelEnabled(channel)}
                        className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {channel.enabled ? 'Pause' : 'Enable'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditChannelModal(channel)}
                        className="px-2.5 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Edit2 className="w-3 h-3 text-cyan-400" /> Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setChannelToDelete(channel)}
                        className="p-1.5 bg-cool-gray-800 hover:bg-rose-950/40 border border-cool-gray-700 hover:border-rose-500/40 text-cool-gray-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
                        title="Delete Channel"
                        aria-label={`Delete ${channel.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: SCHEDULES & ROUTING */}
      {currentSubTab === 'schedules' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveSchedulesAndRouting} className="space-y-4">
            {/* Global Daily Digest Schedule */}
            <div className="bg-cool-gray-850/75 border border-cool-gray-750 rounded-xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cool-gray-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" /> Global Daily Digest Window
                  </h3>
                  <p className="text-xs text-cool-gray-400 mt-0.5">
                    Lists configured for Daily Digest (Combined or Separate) dispatch automatically at this time.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-cool-gray-200">
                  <input
                    type="checkbox"
                    id="digestEnabledCheck"
                    checked={digestEnabled}
                    onChange={(e) => setDigestEnabled(e.target.checked)}
                    className="w-4 h-4 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                  Enable Scheduled Daily Digest
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cool-gray-300 block">
                    Daily Dispatch Time
                  </label>
                  <input
                    type="time"
                    required
                    value={digestTime}
                    onChange={(e) => setDigestTime(e.target.value)}
                    className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cool-gray-300 block">
                    Time Zone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-cool-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-cool-gray-300 block">
                    Default Fallback Channels
                  </label>
                  <span className="text-[11px] text-cool-gray-400">
                    Used when an enabled list has no specific channels selected
                  </span>
                </div>
                {channels.length === 0 ? (
                  <p className="text-xs text-cool-gray-500">
                    No channels configured yet. Add channels in the Channels tab first.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {channels.map((ch) => (
                      <label
                        key={ch.id}
                        className="flex items-center gap-2.5 p-2.5 bg-cool-gray-900 border border-cool-gray-800 rounded-lg cursor-pointer text-xs hover:border-cool-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={defaultChannelIds.includes(ch.id)}
                          onChange={() => toggleIdInList(ch.id, setDefaultChannelIds)}
                          className="w-4 h-4 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-cool-gray-200 block truncate">
                            {ch.name}
                          </span>
                          <span className="text-[11px] text-cool-gray-400 block">
                            {getChannelTypeLabel(ch.type)}
                            {!ch.enabled ? ' · Paused' : ''}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                disabled={isTriggeringDigest}
                onClick={handleTriggerDailyDigestNow}
                className="w-full sm:w-auto px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-amber-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {isTriggeringDigest ? 'Dispatching Digests...' : 'Run Daily Digest Now'}
              </button>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full sm:w-auto px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingSettings ? 'Saving...' : 'Save Digest & Schedules'}
              </button>
            </div>
          </form>

          {/* Enrolled Lists Summary */}
          <div className="bg-cool-gray-850/75 border border-cool-gray-750 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cool-gray-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-white">List Notification Subscriptions</h3>
                <p className="text-xs text-cool-gray-400">
                  Per-list delivery channels and frequencies configured inside Catalog → Lists.
                </p>
              </div>
              <span className="text-xs text-cool-gray-400 tabular-nums whitespace-nowrap shrink-0">
                {enabledLists.length} of {customLists.length} lists enabled
              </span>
            </div>

            {enabledLists.length === 0 ? (
              <div className="p-6 text-center text-xs text-cool-gray-400">
                No lists have notifications enabled yet. Edit any list under Catalog → Lists to choose delivery channels and frequencies.
              </div>
            ) : (
              <div className="divide-y divide-cool-gray-800">
                {enabledLists.map((list) => {
                  const digestMode = resolveEffectiveDailyDigestMode(list);
                  const isSending = triggeringListId === list.id;
                  return (
                    <div
                      key={list.id}
                      className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-white truncate">{list.name}</div>
                        <div className="text-[11px] text-cool-gray-400">
                          {formatListNotificationSummary(list, channels)}
                          {list.notificationRecipientOverride ? (
                            <>
                              {' '}
                              · Override: <span className="font-mono text-cool-gray-300">{list.notificationRecipientOverride}</span>
                            </>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-cool-gray-500 tabular-nums">
                          {list.items?.length || 0} items · Digest mode:{' '}
                          {digestMode === 'combined'
                            ? 'Combined'
                            : digestMode === 'separate'
                              ? 'Separate'
                              : 'Excluded'}
                          {list.lastNotifiedAt
                            ? ` · Last sent ${new Date(list.lastNotifiedAt).toLocaleString()}`
                            : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSending}
                        onClick={() => handleTriggerSingleListNow(list)}
                        className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 text-cyan-400" />
                        {isSending ? 'Sending...' : 'Send Now'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DELIVERY LOGS */}
      {currentSubTab === 'logs' && (
        <div className="space-y-3">
          <div className="bg-cool-gray-850/75 border border-cool-gray-750 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-cool-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search logs by title, message, list, or channel..."
                  className="w-full h-9 pl-8 pr-3 bg-cool-gray-900 border border-cool-gray-750 rounded-lg text-xs text-white placeholder-cool-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value as any)}
                className="h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success Only</option>
                <option value="failed">Failed Only</option>
              </select>

              <select
                value={logChannelFilter}
                onChange={(e) => setLogChannelFilter(e.target.value)}
                className="h-9 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="all">All Channels</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearLogs(true)}
                className="px-3 py-2 bg-cool-gray-800 hover:bg-rose-950/40 border border-cool-gray-700 hover:border-rose-500/40 text-rose-300 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 self-start md:self-auto"
              >
                Clear Logs
              </button>
            )}
          </div>

          <div className="bg-cool-gray-850/75 border border-cool-gray-750 rounded-xl overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-10 text-center space-y-2 text-cool-gray-400">
                <History className="w-7 h-7 mx-auto text-cool-gray-500" />
                <div className="text-xs font-semibold text-cool-gray-300">
                  {logs.length === 0
                    ? 'No notifications dispatched yet.'
                    : 'No log entries match your search or filters.'}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-cool-gray-800 max-h-[540px] overflow-y-auto">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-3.5 space-y-1.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-bold text-white truncate">{log.title}</span>
                      <span
                        className={`text-[11px] font-bold shrink-0 ${
                          log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {log.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </div>

                    <div className="text-[11px] text-cool-gray-400 font-mono whitespace-pre-wrap line-clamp-3">
                      {log.message}
                    </div>

                    {log.error && (
                      <div className="text-[11px] text-rose-300 bg-rose-950/20 p-2 rounded-lg font-mono border border-rose-500/25">
                        {log.error}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-cool-gray-500 tabular-nums pt-0.5">
                      <span>{log.channelName || getChannelTypeLabel(log.method)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{getEventSourceLabel(log.eventSource)}</span>
                      {log.listName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>List: {log.listName}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{new Date(log.sentAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT CHANNEL MODAL */}
      {isChannelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setIsChannelModalOpen(false)}
        >
          <form
            onSubmit={handleSaveChannel}
            onClick={(e) => e.stopPropagation()}
            className="bg-cool-gray-850 border border-cool-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="border-b border-cool-gray-750 pb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingChannelId ? 'Edit Notification Channel' : 'Add Notification Channel'}
              </h3>
              <button
                type="button"
                onClick={() => setIsChannelModalOpen(false)}
                className="text-cool-gray-400 hover:text-white cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalTestResult && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                  modalTestResult.success
                    ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-300'
                    : 'bg-rose-950/25 border-rose-500/35 text-rose-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{modalTestResult.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-300 block">
                  Channel Name
                </label>
                <input
                  type="text"
                  required
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="e.g. Owner Email, Kitchen Webhook"
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white placeholder-cool-gray-500 focus:outline-none focus:border-cyan-500 text-xs"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-cool-gray-300 block">
                  Gateway Type
                </label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value as NotificationChannelType)}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="smtp_email">SMTP Email</option>
                  <option value="webhook">Webhook POST</option>
                  <option value="in_app">In-App Log</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                checked={channelEnabled}
                onChange={(e) => setChannelEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500"
              />
              <span className="font-semibold text-cool-gray-200">Channel Enabled</span>
              <span className="text-cool-gray-400">
                (Paused channels remain saved but are skipped during dispatch)
              </span>
            </label>

            {channelType === 'smtp_email' && (
              <div className="pt-3 border-t border-cool-gray-800 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-cool-gray-400 font-semibold block">SMTP Host</label>
                    <input
                      type="text"
                      required
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-cool-gray-400 font-semibold block">SMTP Port</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="587"
                      className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg p-2 text-white tabular-nums"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={smtpSecure}
                        onChange={(e) => setSmtpSecure(e.target.checked)}
                        className="w-4 h-4 bg-cool-gray-900 border-cool-gray-750 rounded text-cyan-500"
                      />
                      <span className="font-semibold text-cool-gray-300">Use SSL (Port 465)</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-cool-gray-400 font-semibold block">SMTP Username</label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="your-email@gmail.com"
                      className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-cool-gray-400 font-semibold block">
                      SMTP Password / App Key
                    </label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-cool-gray-400 font-semibold block">
                      Sender Address ("From")
                    </label>
                    <input
                      type="text"
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      placeholder="Freezer Tracker <your-email@gmail.com>"
                      className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-cool-gray-400 font-semibold block">
                      Default Recipient ("To")
                    </label>
                    <input
                      type="text"
                      required
                      value={smtpTo}
                      onChange={(e) => setSmtpTo(e.target.value)}
                      placeholder="ops@domain.com"
                      className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {channelType === 'webhook' && (
              <div className="pt-3 border-t border-cool-gray-800 space-y-2 text-xs">
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-semibold block">
                    Target HTTP Webhook URL
                  </label>
                  <input
                    type="url"
                    required
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.domain.com/v1/webhooks/freezer-alerts"
                    className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <p className="text-[11px] text-cool-gray-400">
                  Dispatches an HTTP POST request with JSON fields{' '}
                  <code className="text-cyan-300">title</code>,{' '}
                  <code className="text-cyan-300">message</code>,{' '}
                  <code className="text-cyan-300">eventSource</code>,{' '}
                  <code className="text-cyan-300">listId</code>, and{' '}
                  <code className="text-cyan-300">timestamp</code>.
                </p>
              </div>
            )}

            {channelType === 'in_app' && (
              <div className="pt-3 border-t border-cool-gray-800 text-xs text-cool-gray-400">
                In-App Log channels record every triggered notification directly into the Delivery Logs history without sending external emails or HTTP requests.
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-cool-gray-750">
              <button
                type="button"
                disabled={isTestingModalChannel}
                onClick={handleTestModalChannel}
                className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-200 border border-cool-gray-700 font-semibold rounded-lg transition text-xs cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-cyan-400 ${isTestingModalChannel ? 'animate-spin' : ''}`}
                />
                {isTestingModalChannel ? 'Testing...' : 'Test Connection'}
              </button>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(false)}
                  className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-semibold rounded-lg transition text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingChannel}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition text-xs cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  {isSavingChannel
                    ? 'Saving...'
                    : editingChannelId
                      ? 'Save Channel'
                      : 'Create Channel'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CHANNEL CONFIRMATION MODAL */}
      {channelToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setChannelToDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-cool-gray-850 border border-cool-gray-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Channel?</h3>
            </div>
            <p className="text-xs text-cool-gray-300 leading-relaxed">
              Delete <strong className="text-white">"{channelToDelete.name}"</strong>? Any lists or system routes referencing this channel will stop delivering through it.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteChannel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR LOGS CONFIRMATION MODAL */}
      {confirmClearLogs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setConfirmClearLogs(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-cool-gray-850 border border-cool-gray-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Clear Delivery Logs?</h3>
            </div>
            <p className="text-xs text-cool-gray-300 leading-relaxed">
              Remove all {logs.length} notification delivery log entries? Configured channels and schedules will not be affected.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => setConfirmClearLogs(false)}
                className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Clear Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
