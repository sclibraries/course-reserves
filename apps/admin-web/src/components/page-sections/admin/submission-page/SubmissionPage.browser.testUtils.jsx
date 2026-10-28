import PropTypes from 'prop-types';
import { Route, Routes } from 'react-router-dom';
import AdminLayout from '../../../layout/AdminLayout';
import Header from '../../../layout/Header';
import SubmissionPage from './SubmissionPage';
import ItemWorkPane from './item-pane/ItemWorkPane';
import { createLinkingState } from './SubmissionPage.testUtils';
import { screenshotFolders } from './SubmissionPage.browser.fixtures';

function PageContent({ folders = screenshotFolders }) {
  return (
    <SubmissionPage
      submission={{
        id: 31, uuid: 'test-submission-31', courseCode: 'ENG 101', courseTitle: 'Synthetic Literature',
        section: '01', term: 'Fall 2026', facultyName: 'Test Faculty', submittedAt: '2026-06-16T12:00:00Z',
        status: 'processing', isLocked: false, linkState: 'linked', folioCourseListingId: 'test-listing-31',
      }}
      folders={folders}
      unfolderedItems={[]}
      currentUser={{ id: '999000001', username: 'devadmin' }}
      onBack={() => {}}
      onLock={() => {}}
      onUnlock={() => {}}
      linking={createLinkingState()}
      renderSelectedItem={(selected) => (
        <ItemWorkPane
          key={`${selected.kind}/${selected.id}`}
          item={selected}
          submission={{ facultyName: 'Test Faculty' }}
          currentUsername="devadmin"
          onChanged={() => {}}
          onGoToWork={() => {}}
          onReopen={() => {}}
        />
      )}
    />
  );
}

PageContent.propTypes = { folders: PropTypes.arrayOf(PropTypes.object) };

function WorkbenchShell({ folders }) {
  return (
    <>
      <Header />
      <main id="main-content" className="main-content-no-search">
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/submissions/:submissionId" element={<PageContent folders={folders} />} />
          </Route>
        </Routes>
      </main>
    </>
  );
}

WorkbenchShell.propTypes = { folders: PropTypes.arrayOf(PropTypes.object) };

export default WorkbenchShell;
