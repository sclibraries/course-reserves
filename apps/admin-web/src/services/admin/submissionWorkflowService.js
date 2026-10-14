/**
 * @file submissionWorkflowService.js
 * @description Public facade for faculty submission workflow operations
 */

import { apiConfig } from '../../config/api.config';
import { submissionsApi } from './submissionWorkflow/submissionsApi';
import { itemsApi } from './submissionWorkflow/itemsApi';
import { staffApi } from './submissionWorkflow/staffApi';
import { communicationsApi } from './submissionWorkflow/communicationsApi';
import {
  formatSubmissionForDisplay,
  formatProcessingContext,
  formatClaimedItem,
  determinePriority,
} from './submissionWorkflow/submissionFormatters';
import { formatSubmissionDetail } from './submissionWorkflow/submissionDetailFormatter';

export const submissionWorkflowService = {
  getAuthToken: () => apiConfig.getAuthToken(),
  ...submissionsApi,
  ...itemsApi,
  ...staffApi,
  ...communicationsApi,
  formatSubmissionForDisplay,
  formatProcessingContext,
  formatClaimedItem,
  formatSubmissionDetail,
  determinePriority,
};
