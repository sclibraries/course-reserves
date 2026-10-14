import { config } from '../../config';
import { courseApi } from './course/courseApi';
import { folioCourseSearch } from './course/folioCourseSearch';
import { offeringLinkApi } from './course/offeringLinkApi';
import { physicalReferences } from './course/physicalReferences';
import { resourceApi } from './course/resourceApi';

export const adminCourseService = {
  ...courseApi,
  ...resourceApi,
  ...offeringLinkApi,
  ...folioCourseSearch,
  ...physicalReferences,
  getAuthToken: () => config.api.getAuthToken(),
};
