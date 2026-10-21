import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('UI accessibility smoke test', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('has no axe violations across common UI controls', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const commonControls = (
      <main>
        <Button>Default action</Button>
        <Button variant="destructive">Delete action</Button>
        <Button variant="outline">Outline action</Button>
        <Button variant="secondary">Secondary action</Button>
        <Button variant="ghost">Ghost action</Button>
        <Button variant="link">Link action</Button>
        <Badge>Available</Badge>
        <Alert>
          <AlertTitle>Notice title</AlertTitle>
          <AlertDescription>Notice details</AlertDescription>
        </Alert>
        <Card><CardTitle>Course overview</CardTitle></Card>
        <Pagination aria-label="Records pages">
          <PaginationContent>
            <PaginationItem><PaginationLink href="/records?page=1">First page</PaginationLink></PaginationItem>
          </PaginationContent>
        </Pagination>
        <Tabs defaultValue="overview">
          <TabsList aria-label="Course materials">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview content</TabsContent>
          <TabsContent value="details">Details content</TabsContent>
        </Tabs>
        <Label htmlFor="smoke-search">Search term</Label>
        <Input id="smoke-search" />
      </main>
    );

    await act(async () => root?.render(commonControls));

    expect(getByRole(container, 'heading', { name: 'Notice title' })).toBeTruthy();
    expect(getByRole(container, 'heading', { name: 'Course overview' })).toBeTruthy();
    expect(getByRole(container, 'link', { name: 'First page' })).toBeTruthy();

    await act(async () => {
      root?.render(
        <>
          {commonControls}
          <Dialog open>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm request</DialogTitle>
                <DialogDescription>Review your course reserve request.</DialogDescription>
              </DialogHeader>
              <Button>Confirm</Button>
            </DialogContent>
          </Dialog>
        </>,
      );
    });

    expect(getByRole(document.body, 'dialog', { name: 'Confirm request' })).toBeTruthy();
    await expectNoAxeViolations(document.body);
  });
});
