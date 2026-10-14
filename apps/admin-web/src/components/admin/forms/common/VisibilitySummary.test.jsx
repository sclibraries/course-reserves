import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import VisibilitySummary from './VisibilitySummary';

const renderSummary = (props) => renderToStaticMarkup(createElement(VisibilitySummary, {
  useResourceVisibility: true,
  ...props,
}));

describe('VisibilitySummary', () => {
  it('shows date-only visibility boundaries on their local calendar dates', () => {
    const markup = renderSummary({
      resourceStartDate: '2026-12-01',
      resourceEndDate: '2026-12-18',
    });

    expect(markup).toContain('12/1/2026 to 12/18/2026');
  });

  it('keeps the missing and invalid date labels', () => {
    const markup = renderSummary({
      resourceStartDate: '',
      resourceEndDate: 'not-a-date',
    });

    expect(markup).toContain('Not set to Invalid date');
  });
});
