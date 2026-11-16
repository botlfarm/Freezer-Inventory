import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  assignPhotoToTargetInState,
  clearPhotoReferencesInState,
  collectPhotoAttachments,
  doesImageUrlMatchFilename,
  rewritePhotoReferencesInState,
} from '../utils/photoManager';
import { Container, ContainerTemplate, Product } from '../types';

describe('Photo Manager Attachment & Reference Logic', () => {
  it('matches upload filenames across relative paths, ingress URLs, query params, and Windows separators', () => {
    const filename = 'upload-1787863937019-kn1punx5.jpg';

    expect(doesImageUrlMatchFilename(`uploads/${filename}`, filename)).toBe(true);
    expect(doesImageUrlMatchFilename(`/uploads/${filename}`, filename)).toBe(true);
    expect(doesImageUrlMatchFilename(`photos/${filename}`, filename)).toBe(true);
    expect(doesImageUrlMatchFilename(filename, filename)).toBe(true);
    expect(doesImageUrlMatchFilename(`https://ha.local/api/hassio_ingress/abc/uploads/${filename}?v=2`, filename)).toBe(true);
    expect(doesImageUrlMatchFilename(`uploads\\${filename.toUpperCase()}`, filename)).toBe(true);

    expect(doesImageUrlMatchFilename('uploads/other-file.jpg', filename)).toBe(false);
    expect(doesImageUrlMatchFilename(undefined, filename)).toBe(false);
    expect(doesImageUrlMatchFilename('', filename)).toBe(false);
  });

  it('detects container_template attachments even when no placed containers reference the template', () => {
    const products: Product[] = [
      { id: 'prod-1', name: 'Ribeye', primaryCategory: 'Beef', subCategory: 'Steaks' },
    ];
    const containerTemplates: ContainerTemplate[] = [
      {
        id: 'd679e35b-02a2-4bc8-95ee-863b8b398fb5',
        name: 'Teal w/ white polka dots',
        icon: 'Folder',
        imageUrl: 'uploads/upload-1787863937019-kn1punx5.jpg',
      },
      {
        id: 'tpl-other',
        name: 'Sesame Street',
        icon: 'Folder',
      },
    ];
    const containers: Container[] = [
      {
        id: 'cont-1',
        name: 'Unrelated Bin',
        icon: 'Folder',
        imageUrl: 'uploads/upload-other.jpg',
      },
    ];

    const attachments = collectPhotoAttachments(
      { products, containerTemplates, containers },
      'upload-1787863937019-kn1punx5.jpg'
    );

    expect(attachments).toEqual([
      {
        id: 'd679e35b-02a2-4bc8-95ee-863b8b398fb5',
        name: 'Teal w/ white polka dots',
        type: 'container_template',
      },
    ]);
  });

  it('collects product, container_template, and container attachments together', () => {
    const filename = 'upload-shared.jpg';
    const state = {
      products: [
        { id: 'p1', name: 'Brisket', primaryCategory: 'Beef', subCategory: 'Roasts', imageUrl: `uploads/${filename}` },
      ] as Product[],
      containerTemplates: [
        { id: 't1', name: 'Blue Flannel', icon: 'Folder', imageUrl: `uploads/${filename}` },
      ] as ContainerTemplate[],
      containers: [
        { id: 'c1', name: 'Blue Flannel', icon: 'Folder', templateId: 't1', imageUrl: `uploads/${filename}` },
      ] as Container[],
    };

    const attachments = collectPhotoAttachments(state, filename);
    expect(attachments).toEqual([
      { id: 'p1', name: 'Brisket', type: 'product' },
      { id: 't1', name: 'Blue Flannel', type: 'container_template' },
      { id: 'c1', name: 'Blue Flannel', type: 'container' },
    ]);
  });

  it('clears photo references across products, containerTemplates, and containers during bulk delete', () => {
    const filename = 'upload-1787863937019-kn1punx5.jpg';
    const state = {
      products: [
        { id: 'p1', name: 'Steak', primaryCategory: 'Beef', subCategory: 'Steaks', imageUrl: `uploads/${filename}` },
        { id: 'p2', name: 'Roast', primaryCategory: 'Beef', subCategory: 'Roasts', imageUrl: 'uploads/keep.jpg' },
      ] as Product[],
      containerTemplates: [
        { id: 't1', name: 'Teal w/ white polka dots', icon: 'Folder', imageUrl: `uploads/${filename}` },
      ] as ContainerTemplate[],
      containers: [
        { id: 'c1', name: 'Teal w/ white polka dots', icon: 'Folder', templateId: 't1', imageUrl: `uploads/${filename}` },
      ] as Container[],
    };

    const changed = clearPhotoReferencesInState(state, [filename, '../traversal.jpg']);
    expect(changed).toBe(true);
    expect(state.products[0].imageUrl).toBeUndefined();
    expect(state.products[1].imageUrl).toBe('uploads/keep.jpg');
    expect(state.containerTemplates[0].imageUrl).toBeUndefined();
    expect(state.containers[0].imageUrl).toBeUndefined();
  });

  it('rewrites photo references across products, containerTemplates, and containers during deduplication', () => {
    const dupe = 'upload-dupe.jpg';
    const canonicalUrl = 'uploads/upload-canonical.jpg';
    const state = {
      products: [
        { id: 'p1', name: 'Steak', primaryCategory: 'Beef', subCategory: 'Steaks', imageUrl: `uploads/${dupe}` },
      ] as Product[],
      containerTemplates: [
        { id: 't1', name: 'Teal w/ white polka dots', icon: 'Folder', imageUrl: `uploads/${dupe}` },
      ] as ContainerTemplate[],
      containers: [
        { id: 'c1', name: 'Teal w/ white polka dots', icon: 'Folder', templateId: 't1', imageUrl: `uploads/${dupe}` },
      ] as Container[],
    };

    const changed = rewritePhotoReferencesInState(state, [dupe], canonicalUrl);
    expect(changed).toBe(true);
    expect(state.products[0].imageUrl).toBe(canonicalUrl);
    expect(state.containerTemplates[0].imageUrl).toBe(canonicalUrl);
    expect(state.containers[0].imageUrl).toBe(canonicalUrl);
  });

  it('assigns photos to products, container_templates (cascading to linked containers), and standalone containers', () => {
    const state = {
      products: [
        { id: 'p1', name: 'Ribeye', primaryCategory: 'Beef', subCategory: 'Steaks' },
      ] as Product[],
      containerTemplates: [
        { id: 't1', name: 'Sesame Street', icon: 'Folder' },
        { id: 't2', name: 'Blue Flannel', icon: 'Folder', imageUrl: 'uploads/flannel.jpg' },
      ] as ContainerTemplate[],
      containers: [
        { id: 'c1', name: 'Sesame Street', icon: 'Folder', templateId: 't1' },
        { id: 'c2', name: 'Blue Flannel', icon: 'Folder', templateId: 't2', imageUrl: 'uploads/flannel.jpg' },
      ] as Container[],
    };

    const prodRes = assignPhotoToTargetInState(state, {
      imageUrl: 'uploads/ribeye.jpg',
      targetId: 'p1',
      targetType: 'product',
    });
    expect(prodRes).toEqual({ found: true, updatedTables: ['products'] });
    expect(state.products[0].imageUrl).toBe('uploads/ribeye.jpg');

    const tplRes = assignPhotoToTargetInState(state, {
      imageUrl: 'uploads/sesame.jpg',
      targetId: 't1',
      targetType: 'container_template',
    });
    expect(tplRes).toEqual({ found: true, updatedTables: ['container_templates', 'containers'] });
    expect(state.containerTemplates[0].imageUrl).toBe('uploads/sesame.jpg');
    expect(state.containers[0].imageUrl).toBe('uploads/sesame.jpg');

    // Assigning a different photo to a template-linked container decouples it so template normalization won't overwrite it
    const contRes = assignPhotoToTargetInState(state, {
      imageUrl: 'uploads/custom-bin.jpg',
      targetId: 'c2',
      targetType: 'container',
    });
    expect(contRes).toEqual({ found: true, updatedTables: ['containers'] });
    expect(state.containers[1].imageUrl).toBe('uploads/custom-bin.jpg');
    expect(state.containers[1].templateId).toBeUndefined();
  });

  it('guards PhotoManagerView against destructive UNDO/REDO refresh hacks and dropped undefined unlink payloads', () => {
    const photoManagerSrc = fs.readFileSync(
      path.resolve(__dirname, '../views/PhotoManagerView.tsx'),
      'utf8'
    );
    expect(photoManagerSrc).not.toContain("type: 'UNDO'");
    expect(photoManagerSrc).not.toContain("type: 'REDO'");
    expect(photoManagerSrc).not.toContain('imageUrl: undefined');
    expect(photoManagerSrc).toContain("imageUrl: ''");
    expect(photoManagerSrc).toContain("att.type === 'container_template'");
    expect(photoManagerSrc).toContain('resolveImageUrl(photo.url)');
  });
});
