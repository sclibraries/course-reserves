import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { getByRole } from '@testing-library/dom';
import { Badge } from './badge';
import { Button } from './button';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Card, CardHeader, CardTitle } from './card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
expect.extend({ toHaveNoViolations });

async function expectNoAxeViolations(container) {
  expect(await axe(container)).toHaveNoViolations();
}

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

  it('renders accessible UI foundations and scans the fixture and open dialog', async () => {
    await act(async () => {
      root.render(createElement('div', null,
        createElement(Button, null, 'Default action'),
        createElement(Button, { variant: 'outline' }, 'Secondary action'),
        createElement(Badge, { variant: 'secondary' }, 'Ready'),
        createElement(Alert, null,
          createElement(AlertTitle, null, 'Request saved'),
          createElement(AlertDescription, null, 'The course reserve request is ready.'),
        ),
        createElement(Card, null,
          createElement(CardHeader, null,
            createElement(CardTitle, null, 'Course materials'),
          ),
        ),
        createElement(Tabs, { defaultValue: 'overview' },
          createElement(TabsList, null,
            createElement(TabsTrigger, { value: 'overview' }, 'Overview'),
          ),
          createElement(TabsContent, { value: 'overview' }, 'Overview content'),
        ),
        createElement(Dialog, null,
          createElement(DialogTrigger, { asChild: true },
            createElement(Button, null, 'Open accessible dialog'),
          ),
          createElement(DialogContent, null,
            createElement(DialogTitle, null, 'Accessible dialog title'),
            createElement(DialogDescription, null, 'Dialog description'),
          ),
        ),
      ));
    });

    const primaryButton = getByRole(container, 'button', { name: 'Default action' });
    expect(primaryButton.className).toContain('tw-bg-primary');
    const secondaryButton = getByRole(container, 'button', { name: 'Secondary action' });
    expect(secondaryButton.className).toContain('tw-border-input');
    expect(container.textContent).toContain('Ready');
    expect(getByRole(container, 'heading', { name: 'Request saved' })).toBeTruthy();
    expect(getByRole(container, 'heading', { name: 'Course materials' })).toBeTruthy();
    expect(getByRole(container, 'tab', { name: 'Overview' })).toBeTruthy();
    expect(getByRole(container, 'tabpanel').textContent).toContain('Overview content');

    await expectNoAxeViolations(container);

    await act(async () => getByRole(container, 'button', { name: 'Open accessible dialog' }).click());
    const dialog = getByRole(document.body, 'dialog', { name: 'Accessible dialog title' });
    expect(getByRole(dialog, 'heading', { name: 'Accessible dialog title' })).toBeTruthy();
    expect(dialog.textContent).toContain('Dialog description');
    await expectNoAxeViolations(document.body);
  });
});
