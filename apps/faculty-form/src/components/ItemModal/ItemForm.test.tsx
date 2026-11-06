import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ItemForm from './ItemForm';
import { createEmptyItemData, type ItemData } from './itemFormData';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ControlledItemForm() {
  const [formData, setFormData] = useState<ItemData>({ ...createEmptyItemData(), materialType: 'Article' });
  return <ItemForm formData={formData} setFormData={setFormData} />;
}

describe('ItemForm', () => {
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

  const renderForm = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<ControlledItemForm />));
  };

  const chooseMaterialType = (materialType: string) => {
    const trigger = document.querySelector('#materialType') as HTMLButtonElement;
    act(() => {
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    const option = Array.from(document.querySelectorAll('[role="option"]')).find((element) => (
      element.textContent === materialType
    ));
    expect(option).toBeTruthy();
    act(() => option?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };

  it('offers Ebook and shows Pages to read only for books and chapters', async () => {
    renderForm();

    chooseMaterialType('Ebook');
    expect(document.querySelector('#materialType')?.textContent).toContain('Ebook');
    expect(document.querySelector('label[for="assignedPages"]')).not.toBeNull();
    await expectNoAxeViolations(container!);

    chooseMaterialType('Book');
    expect(document.querySelector('#assignedPages')).not.toBeNull();
    chooseMaterialType('Book Chapter');
    expect(document.querySelector('#assignedPages')).not.toBeNull();
    chooseMaterialType('Article');
    expect(document.querySelector('#assignedPages')).toBeNull();
  });
});
