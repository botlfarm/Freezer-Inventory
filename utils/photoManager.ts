import { Container, ContainerTemplate, Freezer, Product } from '../types';

export type PhotoAttachmentType = 'product' | 'container' | 'container_template';

export type ConnectTargetTypeFilter =
  | 'all'
  | 'product'
  | 'container'
  | 'container_template'
  | 'container_instance';

export type ConnectPhotoStatusFilter = 'all' | 'with_photo' | 'without_photo';

export interface PhotoAttachment {
  id: string;
  name: string;
  type: PhotoAttachmentType;
}

export interface PhotoTargetState {
  products?: Product[];
  containers?: Container[];
  containerTemplates?: ContainerTemplate[];
  freezers?: Freezer[];
}

export interface ConnectableObject {
  id: string;
  name: string;
  type: PhotoAttachmentType;
  details?: string;
  imageUrl?: string;
  isArchived?: boolean;
}

export function normalizeImageUrlValue(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function doesImageUrlMatchFilename(
  imageUrl: string | undefined | null,
  filename: string
): boolean {
  if (!imageUrl || !filename) return false;
  const cleanedImg = imageUrl.trim().split(/[?#]/)[0].replace(/\\/g, '/').toLowerCase();
  const lowF = filename.trim().toLowerCase();
  if (!cleanedImg || !lowF) return false;

  return (
    cleanedImg === `uploads/${lowF}` ||
    cleanedImg === `/uploads/${lowF}` ||
    cleanedImg === `photos/${lowF}` ||
    cleanedImg === `/photos/${lowF}` ||
    cleanedImg === lowF ||
    cleanedImg.endsWith(`/${lowF}`)
  );
}

export function collectPhotoAttachments(
  state: PhotoTargetState,
  filename: string
): PhotoAttachment[] {
  const attachments: PhotoAttachment[] = [];

  (state.products || []).forEach((p) => {
    if (doesImageUrlMatchFilename(p.imageUrl, filename)) {
      attachments.push({ id: p.id, name: p.name, type: 'product' });
    }
  });

  (state.containerTemplates || []).forEach((t) => {
    if (doesImageUrlMatchFilename(t.imageUrl, filename)) {
      attachments.push({ id: t.id, name: t.name, type: 'container_template' });
    }
  });

  (state.containers || []).forEach((c) => {
    if (doesImageUrlMatchFilename(c.imageUrl, filename)) {
      attachments.push({ id: c.id, name: c.name, type: 'container' });
    }
  });

  return attachments;
}

export function clearPhotoReferencesInState(
  state: PhotoTargetState,
  filenames: string[]
): boolean {
  let dbChanged = false;

  for (const rawName of filenames) {
    if (!rawName || rawName.includes('..') || rawName.includes('/') || rawName.includes('\\')) {
      continue;
    }

    (state.products || []).forEach((p) => {
      if (doesImageUrlMatchFilename(p.imageUrl, rawName)) {
        p.imageUrl = undefined;
        dbChanged = true;
      }
    });

    (state.containerTemplates || []).forEach((t) => {
      if (doesImageUrlMatchFilename(t.imageUrl, rawName)) {
        t.imageUrl = undefined;
        dbChanged = true;
      }
    });

    (state.containers || []).forEach((c) => {
      if (doesImageUrlMatchFilename(c.imageUrl, rawName)) {
        c.imageUrl = undefined;
        dbChanged = true;
      }
    });
  }

  return dbChanged;
}

export function rewritePhotoReferencesInState(
  state: PhotoTargetState,
  sourceFilenames: string[],
  canonicalUrl: string
): boolean {
  let dbChanged = false;

  for (const filename of sourceFilenames) {
    (state.products || []).forEach((p) => {
      if (doesImageUrlMatchFilename(p.imageUrl, filename)) {
        p.imageUrl = canonicalUrl;
        dbChanged = true;
      }
    });

    (state.containerTemplates || []).forEach((t) => {
      if (doesImageUrlMatchFilename(t.imageUrl, filename)) {
        t.imageUrl = canonicalUrl;
        dbChanged = true;
      }
    });

    (state.containers || []).forEach((c) => {
      if (doesImageUrlMatchFilename(c.imageUrl, filename)) {
        c.imageUrl = canonicalUrl;
        dbChanged = true;
      }
    });
  }

  return dbChanged;
}

export function assignPhotoToTargetInState(
  state: PhotoTargetState,
  params: {
    imageUrl?: string | null;
    targetId: string;
    targetType: PhotoAttachmentType;
  }
): { found: boolean; updatedTables: string[] } {
  const normalizedUrl = normalizeImageUrlValue(params.imageUrl);
  const { targetId, targetType } = params;

  if (targetType === 'product') {
    const p = (state.products || []).find((item) => item.id === targetId);
    if (!p) return { found: false, updatedTables: [] };
    p.imageUrl = normalizedUrl;
    return { found: true, updatedTables: ['products'] };
  }

  if (targetType === 'container_template') {
    const tpl = (state.containerTemplates || []).find((item) => item.id === targetId);
    if (!tpl) return { found: false, updatedTables: [] };
    tpl.imageUrl = normalizedUrl;
    let containersUpdated = false;
    (state.containers || []).forEach((c) => {
      if (c.templateId === tpl.id) {
        c.imageUrl = normalizedUrl;
        containersUpdated = true;
      }
    });
    return {
      found: true,
      updatedTables: containersUpdated
        ? ['container_templates', 'containers']
        : ['container_templates'],
    };
  }

  if (targetType === 'container') {
    const c = (state.containers || []).find((item) => item.id === targetId);
    if (!c) return { found: false, updatedTables: [] };
    c.imageUrl = normalizedUrl;
    // If container is linked to a template whose image differs, decouple from template
    // so convertAndNormalizeContainerTemplates does not overwrite the new image on save.
    if (c.templateId) {
      const linkedTpl = (state.containerTemplates || []).find((t) => t.id === c.templateId);
      if (linkedTpl && normalizeImageUrlValue(linkedTpl.imageUrl) !== normalizedUrl) {
        c.templateId = undefined;
      }
    }
    return { found: true, updatedTables: ['containers'] };
  }

  return { found: false, updatedTables: [] };
}

export function buildConnectableObjects(state: PhotoTargetState): ConnectableObject[] {
  const objects: ConnectableObject[] = [];
  const freezerNameById = new Map<string, string>();
  (state.freezers || []).forEach((f) => {
    if (f && f.id) freezerNameById.set(f.id, f.name);
  });

  (state.products || []).forEach((p) => {
    objects.push({
      id: p.id,
      name: p.name,
      type: 'product',
      details: `${p.primaryCategory} > ${p.subCategory}`,
      imageUrl: normalizeImageUrlValue(p.imageUrl),
      isArchived: !!p.isArchived,
    });
  });

  (state.containerTemplates || []).forEach((t) => {
    objects.push({
      id: t.id,
      name: t.name,
      type: 'container_template',
      details: 'Container Template',
      imageUrl: normalizeImageUrlValue(t.imageUrl),
    });
  });

  (state.containers || []).forEach((c) => {
    if (c.id === 'staging_loose' || c.id.endsWith('_loose')) return;
    const freezerName = c.freezerId ? freezerNameById.get(c.freezerId) : undefined;
    objects.push({
      id: c.id,
      name: c.name,
      type: 'container',
      details: freezerName ? `In ${freezerName}` : c.freezerId ? 'Placed Container' : 'Unassigned Bin',
      imageUrl: normalizeImageUrlValue(c.imageUrl),
      isArchived: !!c.isArchived,
    });
  });

  return objects;
}

export function filterConnectableObjects(
  objects: ConnectableObject[],
  options: {
    search?: string;
    typeFilter?: ConnectTargetTypeFilter;
    photoFilter?: ConnectPhotoStatusFilter;
  } = {}
): ConnectableObject[] {
  const { search = '', typeFilter = 'all', photoFilter = 'all' } = options;
  const searchTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);

  return objects
    .filter((obj) => {
      if (typeFilter === 'product' && obj.type !== 'product') return false;
      if (typeFilter === 'container' && obj.type !== 'container' && obj.type !== 'container_template') {
        return false;
      }
      if (typeFilter === 'container_template' && obj.type !== 'container_template') return false;
      if (typeFilter === 'container_instance' && obj.type !== 'container') return false;

      const hasPhoto = !!normalizeImageUrlValue(obj.imageUrl);
      if (photoFilter === 'with_photo' && !hasPhoto) return false;
      if (photoFilter === 'without_photo' && hasPhoto) return false;

      if (searchTerms.length > 0) {
        const haystack = `${obj.name} ${obj.details || ''}`.toLowerCase();
        if (!searchTerms.every((term) => haystack.includes(term))) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const archivedDiff = Number(!!a.isArchived) - Number(!!b.isArchived);
      if (archivedDiff !== 0) return archivedDiff;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
}
