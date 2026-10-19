import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NewSubmissionHeader } from '@/components/pageHeaders/NewSubmissionHeader';
import { SubmissionDetailHeader } from '@/components/pageHeaders/SubmissionDetailHeader';
import type { CourseReserve } from '@/store/courseReservesStore';

const bannerMock = vi.hoisted(() => ({ visible: true }));

vi.mock('@/components/ActingForBanner', () => ({
  ActingForBanner: () => bannerMock.visible
    ? <div role="status" data-testid="acting-for-banner">Acting for Test Faculty</div>
    : null,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const noOp = () => undefined;
const reserve: CourseReserve = {
  id: 'reserve-test', courseCode: 'BIO 220', courseTitle: 'Ecology', section: '01', instructors: 'Test Faculty',
  term: 'Fall 2026', status: 'submitted', items: [], folders: [], layout: [], lastUpdated: '2026-10-01',
};

const pageHeaders = [
  {
    name: 'dashboard',
    render: <DashboardHeader user={null} isAuthenticated={false} termsLoading={false} termName="Fall 2026" onLogout={noOp} />,
  },
  { name: 'new submission', render: <NewSubmissionHeader onBack={noOp} /> },
  {
    name: 'submission detail',
    render: <SubmissionDetailHeader reserve={reserve} canEdit={false} onBack={noOp} onEdit={noOp} onDelete={noOp} />,
  },
];

describe.each(pageHeaders)('StickyTop layout for $name', ({ render }) => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    bannerMock.visible = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('renders the acting-for banner after the page header inside the sticky region', () => {
    act(() => root?.render(render));

    const region = container?.querySelector('[data-testid="page-sticky-top"]');
    const header = region?.querySelector('header');
    const banner = region?.querySelector('[data-testid="acting-for-banner"]');

    expect(region).not.toBeNull();
    expect(header).not.toBeNull();
    expect(banner).not.toBeNull();
    expect(Boolean(header!.compareDocumentPosition(banner!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('does not render an acting-for banner when there is no selected faculty member', () => {
    bannerMock.visible = false;
    act(() => root?.render(render));

    expect(container?.querySelector('[data-testid="page-sticky-top"] header')).not.toBeNull();
    expect(container?.querySelector('[data-testid="page-sticky-top"] [role="status"]')).toBeNull();
  });
});
