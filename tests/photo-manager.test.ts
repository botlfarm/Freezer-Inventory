import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  assignPhotoToTargetInState,
  buildConnectableObjects,
  clearPhotoReferencesInState,
  collectPhotoAttachments,
  doesImageUrlMatchFilename,
  filterConnectableObjects,
  rewritePhotoReferencesInState,
} from '../utils/photoManager';
import { Container, ContainerTemplate, Freezer, Product } from '../types';

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

  it('builds and filters connectable objects by item/container type, photo presence, and search query', () => {
    const freezers: Freezer[] = [{ id: 'f1', name: 'Garage Upright' }];
    const products: Product[] = [
      { id: 'p1', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks', imageUrl: 'uploads/ribeye.jpg' },
      { id: 'p2', name: 'Pork Chop', primaryCategory: 'Pork', subCategory: 'Chops' },
      { id: 'p3', name: 'Archived Cut', primaryCategory: 'Beef', subCategory: 'Roasts', isArchived: true },
    ];
    const containerTemplates: ContainerTemplate[] = [
      { id: 't1', name: 'Teal w/ white polka dots', icon: 'Folder', imageUrl: 'uploads/polka.jpg' },
      { id: 't2', name: 'Sesame Street', icon: 'Folder' },
    ];
    const containers: Container[] = [
      { id: 'staging_loose', name: 'Sorting Table', icon: 'Folder' },
      { id: 'f1_loose', name: 'Loose', freezerId: 'f1', icon: 'Folder' },
      { id: 'c1', name: 'Box Saucy', freezerId: 'f1', icon: 'Folder' },
      { id: 'c2', name: 'Blue Flannel', freezerId: 'f1', icon: 'Folder', imageUrl: 'uploads/flannel.jpg' },
    ];

    const all = buildConnectableObjects({ freezers, products, containerTemplates, containers });
    // Excludes staging_loose and *_loose
    expect(all.map((o) => o.id)).toEqual(['p1', 'p2', 'p3', 't1', 't2', 'c1', 'c2']);
    expect(all.find((o) => o.id === 'c1')?.details).toBe('In Garage Upright');

    // Type filters: Items vs Containers (templates + instances) vs Templates only
    expect(filterConnectableObjects(all, { typeFilter: 'product' }).map((o) => o.id)).toEqual([
      'p2',
      'p1',
      'p3',
    ]);
    expect(filterConnectableObjects(all, { typeFilter: 'container' }).map((o) => o.id)).toEqual([
      'c2',
      'c1',
      't2',
      't1',
    ]);
    expect(filterConnectableObjects(all, { typeFilter: 'container_template' }).map((o) => o.id)).toEqual([
      't2',
      't1',
    ]);

    // Photo status filters: with_photo, without_photo, all
    expect(filterConnectableObjects(all, { photoFilter: 'with_photo' }).map((o) => o.id)).toEqual([
      'c2',
      'p1',
      't1',
    ]);
    expect(filterConnectableObjects(all, { photoFilter: 'without_photo' }).map((o) => o.id)).toEqual([
      'c1',
      'p2',
      't2',
      'p3',
    ]);

    // Combined type + photo status + search
    expect(
      filterConnectableObjects(all, {
        typeFilter: 'container',
        photoFilter: 'without_photo',
        search: 'garage',
      }).map((o) => o.id)
    ).toEqual(['c1']);

    expect(
      filterConnectableObjects(all, {
        typeFilter: 'product',
        photoFilter: 'with_photo',
        search: 'beef steak',
      }).map((o) => o.id)
    ).toEqual(['p1']);
  });

  it('guards PhotoManagerView against destructive UNDO/REDO refresh hacks and exposes Connect Photo filters', () => {
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
    expect(photoManagerSrc).toContain('Connect Photo to Item or Container');
    expect(photoManagerSrc).toContain('Connect to Item / Container');
    expect(photoManagerSrc).toContain('without_photo');
    expect(photoManagerSrc).toContain('with_photo');
  });
});
