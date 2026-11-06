import { act, useState } from 'react';
import PropTypes from 'prop-types';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, getByRole } from '@testing-library/dom';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../test/browser';
import FacultyMessageModal from './FacultyMessageModal';
import QuickNoteModal from './QuickNoteModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const item = {
  id: 991,
  submission_id: 742,
  title: 'A synthetic item with a long bibliographic title for narrow screens',
  submission: {
    faculty_display_name: 'Synthetic Faculty',
    faculty_email: 'faculty@example.edu',
    course_code: 'TST 101',
    course_title: 'Synthetic Course with a long title for responsive layout checks',
  },
};

function ModalHarness({ Component, label }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Open {label}</button>
      <Component isOpen={isOpen} toggle={() => setIsOpen(false)} item={item} />
    </>
  );
}

ModalHarness.propTypes = {
  Component: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
};

let root;
let container;

async function inspectModal(Component, label, title) {
  container = document.createElement('main');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ModalHarness Component={Component} label={label} />));
  await act(async () => fireEvent.click(getByRole(container, 'button', { name: `Open ${label}` })));

  expect(getByRole(document.body, 'dialog', { name: title })).toBeTruthy();
  await expectNoAxeViolations();
  await expectNoHorizontalOverflow();

  act(() => root.unmount());
  root = null;
  container.remove();
  container = null;
}

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('communication modals in Chromium', () => {
  it('keeps each open modal accessible and free of horizontal overflow', async () => {
    await inspectModal(FacultyMessageModal, 'faculty message', 'Message Faculty - A synthetic item with a long bibliographic title for narrow screens');
    await inspectModal(QuickNoteModal, 'quick note', 'Quick Note - A synthetic item with a long bibliographic title for narrow screens');
  });
});
