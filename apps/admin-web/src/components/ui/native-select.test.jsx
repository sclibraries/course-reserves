import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { getByRole } from '@testing-library/dom';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import NativeSelect from './native-select';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
expect.extend({ toHaveNoViolations });

describe('NativeSelect', () => {
  let container;
  let root;

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it('forwards native props and refs and has no axe violations', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const ref = createRef();

    await act(async () => root.render(createElement('div', null,
      createElement('label', { htmlFor: 'flow-select' }, 'Flow'),
      createElement(NativeSelect, {
        id: 'flow-select',
        ref,
        name: 'flow',
        required: true,
        className: 'tw-mt-2',
        defaultValue: 'article',
      },
      createElement('option', { value: 'article' }, 'Article')),
    )));

    const select = getByRole(container, 'combobox', { name: 'Flow' });
    expect(select.name).toBe('flow');
    expect(select.required).toBe(true);
    expect(select.value).toBe('article');
    expect(select.className).toContain('tw-border-input');
    expect(select.className).toContain('tw-mt-2');
    expect(ref.current).toBe(select);
    expect(await axe(container)).toHaveNoViolations();
  });
});
