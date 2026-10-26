import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function UiControls({ selectOpen }: { selectOpen: boolean }) {
  return (
    <main>
      <Button>Default action</Button>
      <Button variant="destructive">Delete action</Button>
      <Button variant="outline">Outline action</Button>
      <Button variant="secondary">Secondary action</Button>
      <Button variant="ghost">Ghost action</Button>
      <Button variant="link">Link action</Button>
      <Badge>Available</Badge>
      <Card>
        <CardHeader><CardTitle>Course overview</CardTitle></CardHeader>
        <CardContent>Three items requested.</CardContent>
      </Card>
      <Label htmlFor="browser-search">Search</Label>
      <Input id="browser-search" />
      <Tabs defaultValue="overview">
        <TabsList aria-label="Course materials">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Course overview</TabsContent>
        <TabsContent value="details">Course details</TabsContent>
      </Tabs>
      <Select open={selectOpen} defaultValue="fall">
        <SelectTrigger aria-label="Course term"><SelectValue /></SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectItem value="fall">Fall 2026</SelectItem>
          <SelectItem value="spring">Spring 2027</SelectItem>
        </SelectContent>
      </Select>
      <Dialog open modal={false}>
        <DialogContent>
          <DialogTitle>Confirm request</DialogTitle>
          <DialogDescription>Review the reserve request.</DialogDescription>
        </DialogContent>
      </Dialog>
    </main>
  );
}

describe('UI components in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  async function renderControls(selectOpen = true) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<UiControls selectOpen={selectOpen} />);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelector('[role="listbox"]') !== null).toBe(selectOpen);
  }

  it('has no horizontal overflow at supported widths', async () => {
    await renderControls();
    await expectNoHorizontalOverflow();
  });

  it('has no axe violations, including rendered color contrast', async () => {
    await renderControls(false);
    await expectNoAxeViolations(container!);
  });

  it('has no axe violations in the open Dialog', async () => {
    await renderControls(false);
    await expectNoAxeViolations(document.body.querySelector('[role="dialog"]')!);
  });

  it('has no axe violations in the open Select options', async () => {
    await renderControls();
    await expectNoAxeViolations(document.body.querySelector('[role="listbox"]')!);
  });
});
