import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import ItemCard from './ItemCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

function renderItem(plink) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <ItemCard
        item={{
          id: 'synthetic-item-28',
          title: 'Synthetic Article',
          materialType: 'article',
          status: 'pending',
          priority: 'medium',
          doi: '10.1000/cx028',
          issn: '1234-5678',
          journalTitle: 'Synthetic Journal',
          volume: '12',
          issue: '3',
          eds: { dbId: 'synthetic-database', an: 'synthetic-an', plink },
        }}
        displayNumber="1"
        onClaim={() => undefined}
        onGoToWork={() => undefined}
        onReopen={() => undefined}
        currentUserId={1}
      />
    );
  });
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('ItemCard EDS record link', () => {
  it('shows structured identifiers and opens an HTTP(S) permalink safely', () => {
    renderItem('https://search.ebscohost.com/record/synthetic-cx028');

    const link = Array.from(container.querySelectorAll('a')).find((anchor) =>
      anchor.textContent.includes('View full record')
    );

    expect(container.textContent).toContain('10.1000/cx028');
    expect(container.textContent).toContain('1234-5678');
    expect(container.textContent).toContain('Synthetic Journal');
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('3');
    expect(link?.getAttribute('href')).toBe('https://search.ebscohost.com/record/synthetic-cx028');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each(['javascript:alert(1)', 'ftp://example.test/record', '/relative/record'])(
    'does not render a full-record link for non-HTTP URL %s', (plink) => {
      renderItem(plink);

      const fullRecordLinks = Array.from(container.querySelectorAll('a')).filter((anchor) =>
        anchor.textContent.includes('View full record')
      );

      expect(fullRecordLinks).toHaveLength(0);
    }
  );
});
