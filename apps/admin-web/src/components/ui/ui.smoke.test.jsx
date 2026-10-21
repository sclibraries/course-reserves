import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Badge } from './badge';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('shadcn UI foundation', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders button variants, badge, tabs and an accessible open dialog', async () => {
    await act(async () => {
      root.render(createElement('div', null,
        createElement(Button, null, 'Default action'),
        createElement(Button, { variant: 'outline' }, 'Secondary action'),
        createElement(Badge, { variant: 'secondary' }, 'Ready'),
        createElement(Tabs, { defaultValue: 'overview' },
          createElement(TabsList, null,
            createElement(TabsTrigger, { value: 'overview' }, 'Overview'),
          ),
          createElement(TabsContent, { value: 'overview' }, 'Overview content'),
        ),
        createElement(Dialog, { open: true },
          createElement(DialogContent, null,
            createElement(DialogTitle, null, 'Accessible dialog title'),
            createElement(DialogDescription, null, 'Dialog description'),
          ),
        ),
      ));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons[0].textContent).toContain('Default action');
    expect(buttons[0].className).toContain('bg-primary');
    expect(buttons[1].textContent).toContain('Secondary action');
    expect(buttons[1].className).toContain('border-input');
    expect(container.textContent).toContain('Ready');
    expect(container.querySelector('[role="tab"]')?.textContent).toBe('Overview');
    expect(container.textContent).toContain('Overview content');

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const title = dialog.querySelector('h2');
    expect(title.textContent).toBe('Accessible dialog title');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
  });
});
