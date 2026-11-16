import { Container, ContainerTemplate, Product } from '../types';

export type PhotoAttachmentType = 'product' | 'container' | 'container_template';

export interface PhotoAttachment {
  id: string;
  name: string;
  type: PhotoAttachmentType;
}

export interface PhotoTargetState {
  products?: Product[];
  containers?: Container[];
  containerTemplates?: ContainerTemplate[];
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
