import { matchPath } from 'react-router-dom';

export const STICKY_HEADER_ROUTES = {
  dashboard: '/',
  newSubmission: '/new-submission',
  submissionEdit: '/submission/:id/edit',
  addMaterials: '/submission/:id/edit/add',
  addMaterialsRecord: '/submission/:id/edit/add/record/:dbId/:an',
  submissionDetail: '/submission/:id',
  cloneEditor: '/clone-editor',
  cloneMatchingTest: '/clone-matching-test',
} as const;

export const hasStickyHeader = (pathname: string) =>
  Object.values(STICKY_HEADER_ROUTES).some((path) => matchPath({ path, end: true }, pathname) !== null);
