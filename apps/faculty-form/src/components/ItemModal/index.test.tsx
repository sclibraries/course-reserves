import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ItemModal, type ItemData } from './index';
import { transformItemForEditing } from '@/utils/itemTransformers';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ItemModal', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeAll(() => {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => undefined;
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  const renderModal = (initialData?: ItemData) => {
    const onSave = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <ItemModal
          open={true}
          onOpenChange={() => undefined}
          onSave={onSave}
          initialData={initialData}
        />
      );
    });

    return onSave;
  };

  const fillInput = (selector: string, value: string) => {
    const input = document.querySelector(selector) as HTMLInputElement;

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const chooseMaterialType = (materialType: string) => {
    const trigger = document.querySelector('#materialType') as HTMLButtonElement;

    act(() => {
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });

    const option = Array.from(document.querySelectorAll('[role="option"]')).find((element) =>
      element.textContent === materialType
    );
    expect(option).toBeTruthy();

    act(() => option?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };

  const saveItem = () => {
    const saveButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save Item')
    );

    act(() => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };

  it('creates an electronic item from the empty form using the visible controls', () => {
    const onSave = renderModal();

    chooseMaterialType('Website/Web Page');
    fillInput('#title', 'Electronic reading');
    fillInput('#sourceLink', 'https://example.test/reading');
    saveItem();

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      materialType: 'Website',
      title: 'Electronic reading',
      sourceLink: 'https://example.test/reading',
      requestType: 'link-electronic',
    }));
  });

  it('creates a print item from the empty form using the visible controls', () => {
    const onSave = renderModal();

    chooseMaterialType('Book');
    fillInput('#title', 'Print reading');
    fillInput('#author', 'P. Reader');
    saveItem();

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      materialType: 'Book',
      title: 'Print reading',
      author: 'P. Reader',
      sourceLink: '',
      requestType: 'link-electronic',
    }));
  });

  it('lets an electronic request save without an active file upload control or delivery promise', () => {
    const onSave = renderModal({
      materialType: 'Website',
      title: 'Electronic reading',
      author: 'A. Reader',
      citation: 'A. Reader. Electronic reading.',
      sourceLink: 'https://example.test/reading',
      requestType: 'link-electronic',
      publicNote: '',
    });

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/file upload|upload syllabus|attachment file|files? (?:will be|were) delivered/i);

    const saveButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save Item')
    );

    act(() => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Electronic reading',
      requestType: 'link-electronic',
    }));
  });

  it('lets a print request save without an active file upload control', () => {
    const onSave = renderModal({
      materialType: 'Book',
      title: 'Print reading',
      author: 'P. Reader',
      citation: 'P. Reader. Print reading.',
      sourceLink: '',
      requestType: 'link-physical',
      publicNote: '',
    });

    expect(document.querySelector('input[type="file"]')).toBeNull();

    const saveButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save Item')
    );

    act(() => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Print reading',
      requestType: 'link-physical',
    }));
  });

  it('keeps legacy attachment metadata and editable fields when an old item is saved', () => {
    const initialData = transformItemForEditing({
      id: 'legacy-item',
      materialType: 'book',
      title: 'Legacy title',
      authors: 'Legacy author',
      url: 'https://example.test/legacy',
      notes: 'Keep this note',
      hasAttachment: true,
      attachmentName: 'legacy-citation.pdf',
      attachmentSize: 2048,
      attachmentType: 'application/pdf',
    });
    const onSave = renderModal(initialData);
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/file upload|upload syllabus|attachment file|files? (?:will be|were) delivered/i);
    const titleInput = document.querySelector('#title') as HTMLInputElement;

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(titleInput, 'Edited legacy title');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const saveButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save Item')
    );
    act(() => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Edited legacy title',
      author: 'Legacy author',
      sourceLink: 'https://example.test/legacy',
      publicNote: 'Keep this note',
      hasAttachment: true,
      attachmentName: 'legacy-citation.pdf',
      attachmentSize: 2048,
      attachmentType: 'application/pdf',
    }));
  });
});
