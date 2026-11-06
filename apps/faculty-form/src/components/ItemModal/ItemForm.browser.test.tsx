import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import ItemForm from './ItemForm';
import { type ItemData } from './itemFormData';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';

const ebook: ItemData = {
  materialType: 'Ebook',
  title: 'Synthetic electronic book',
  author: 'A. Example',
  citation: '',
  sourceLink: 'https://example.test/ebook',
  requestType: 'link-electronic',
  publicNote: '',
  assignedPages: '12-16',
};

describe('Item form in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('reflows an Ebook form and has no WCAG 2.2 AA violations', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(
      <ItemForm formData={ebook} setFormData={() => undefined} />,
    ));

    expect(document.body.textContent).toContain('Ebook');
    expect(document.getElementById('assignedPages')).not.toBeNull();
    await expectNoHorizontalOverflow();
    await expectNoAxeViolations();
  });
});
