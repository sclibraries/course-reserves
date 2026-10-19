import { matchPath } from 'react-router-dom';

export const STICKY_HEADER_ROUTES = {
  dashboard: '/',
  newSubmission: '/new-submission',
  submissionEdit: '/submission/:id/edit',
  addMaterials: '/submission/:id/edit/add',
  addMaterialsRecord: '/submission/:id/edit/add/record/:dbId/:an',
  submissionDetail: '/submission/:id',
} as const;

export const hasStickyHeader = (pathname: string) =>
  Object.values(STICKY_HEADER_ROUTES).some((path) => matchPath({ path, end: true }, pathname) !== null);
