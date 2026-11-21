import {
  BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY,
  BUTCHER_BASELINE_GROUPING_CONFIG_KEY,
  BUTCHER_DOC_LINK_TYPES_CONFIG_KEY,
  BUTCHER_ORDER_TAGS_CONFIG_KEY,
  BUTCHER_SPECIES_CONFIG_KEY,
} from './butcherSettings';

export const OFFSITE_USER_CONFIG_KEYS = new Set<string>([
  'report-from-name',
  'report-from-address',
  'offsite-theoretical-box-weight',
]);

export const BUTCHER_USER_CONFIG_KEYS = new Set<string>([
  BUTCHER_SPECIES_CONFIG_KEY,
  BUTCHER_ORDER_TAGS_CONFIG_KEY,
  BUTCHER_DOC_LINK_TYPES_CONFIG_KEY,
  BUTCHER_BASELINE_GROUPING_CONFIG_KEY,
  BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY,
]);

export const USER_WRITABLE_APP_CONFIG_KEYS = new Set<string>([
  ...OFFSITE_USER_CONFIG_KEYS,
  ...BUTCHER_USER_CONFIG_KEYS,
]);

export interface AppConfigRequestBody {
  key?: unknown;
  value?: unknown;
  configs?: unknown;
}

export function extractAppConfigRequestKeys(body: AppConfigRequestBody | null | undefined): string[] {
  if (!body || typeof body !== 'object') return [];
  const keys = new Set<string>();

  if (body.configs && typeof body.configs === 'object' && !Array.isArray(body.configs)) {
    for (const k of Object.keys(body.configs as Record<string, unknown>)) {
      const cleaned = k.trim();
      if (cleaned) keys.add(cleaned);
    }
  }

  if (typeof body.key === 'string' && body.key.trim()) {
    keys.add(body.key.trim());
  }

  return Array.from(keys);
}

/**
 * Returns true if and only if every requested app_config key belongs to the
 * regular-user writable Operations settings allowlist (Off-Site + Butcher Settings).
 */
export function canNonAdminWriteAppConfig(body: AppConfigRequestBody | null | undefined): boolean {
  const keys = extractAppConfigRequestKeys(body);
  if (keys.length === 0) return false;
  return keys.every((k) => USER_WRITABLE_APP_CONFIG_KEYS.has(k));
}
