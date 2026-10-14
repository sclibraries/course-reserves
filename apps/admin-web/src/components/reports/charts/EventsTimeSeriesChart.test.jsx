import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EventsTimeSeriesChart from './EventsTimeSeriesChart';

vi.mock('recharts', async () => {
  const { Children, createElement } = await import('react');
  const renderChildren = ({ children }) => createElement('div', null, children);
  const XAxis = ({ tickFormatter }) => createElement('span', null, tickFormatter('2026-12-18'));
  const Tooltip = ({ labelFormatter }) => createElement('span', null, labelFormatter('2026-12-18'));
  const renderDateFormatters = ({ children }) => createElement('div', null, Children.toArray(children).filter(
    child => child.type === XAxis || child.type === Tooltip
  ));

  return {
    AreaChart: renderDateFormatters,
    Area: () => null,
    CartesianGrid: () => null,
    Tooltip,
    ResponsiveContainer: renderChildren,
    XAxis,
    YAxis: () => null,
  };
});

describe('EventsTimeSeriesChart date-only labels', () => {
  it('keeps SQL DATE values on their local calendar day', () => {
    const markup = renderToStaticMarkup(createElement(EventsTimeSeriesChart, {
      timeSeriesData: [{ date: '2026-12-18', count: 1 }],
    }));

    expect(markup).toContain('12/18');
    expect(markup).toContain('Date: 12/18/2026');
  });
});
