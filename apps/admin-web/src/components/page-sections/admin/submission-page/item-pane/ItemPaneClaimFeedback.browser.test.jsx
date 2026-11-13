import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { getByRole, queryByRole } from '@testing-library/dom';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../../../test/browser';
import ProcessTab from './ProcessTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const item = {
  kind: 'new', id: 7501, title: 'Synthetic reserve item', status: 'in_progress',
  claimed_by: null, readiness: 'missing', allowedAccessPaths: [],
};

const props = {
  item,
  claims: { isMine: false, pending: false, error: 'Synthetic claim failure', claim: () => {} },
  flow: {
    flowState: { flow: null, current_step: null, finished: null, history: [], can_act: false },
    loading: false, pending: false, error: '', notice: '', notes: '', selectedOutcome: null,
    clearNotice: () => {}, loadFlow: () => {}, handleOutcome: () => {}, setNotes: () => {},
  },
  switchFlow: {
    open: false, loading: false, flows: [], selectedFlow: '', pending: false, error: '', canAct: false,
    openSwitchFlow: () => {}, closeSwitchFlow: () => {}, setSelectedFlow: () => {}, submitSwitchFlow: () => {},
  },
  onGoToWork: () => {},
  onReopen: () => {},
};

describe('item claim feedback in Chromium', () => {
  let container;
  let root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('does not repeat a claim failure inline beside the claim action', async () => {
    container = document.createElement('main');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<ProcessTab {...props} />));

    expect(getByRole(container, 'button', { name: 'Claim item' })).toBeTruthy();
    expect(queryByRole(container, 'alert')).toBeNull();
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(container);
  });
});
