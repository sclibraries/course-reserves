import { getSafeErrorFeedback, notify } from '@/services/notify';
import { useDraftStore } from '@/store/draftStore';
import { useReserveStore } from '@/store/useReserveStore';

export interface CorrectionRequiredDetail {
  submissionUuid: string;
  itemIds: number[];
  attemptedUpdate: Record<string, unknown>;
}

export class CorrectionRequiredError extends Error {
  constructor(readonly detail: CorrectionRequiredDetail) {
    super('Processed course-reserve items must be corrected by library staff.');
    this.name = 'CorrectionRequiredError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseCorrectionRequired = async (
  response: Response,
  attemptedUpdate: Record<string, unknown>
): Promise<CorrectionRequiredDetail | null> => {
  if (response.status !== 409) return null;

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return null;
  }

  if (
    !isRecord(body) ||
    body.error_code !== 'materialized_item_correction_required' ||
    typeof body.submission_uuid !== 'string' ||
    !body.submission_uuid.trim() ||
    !Array.isArray(body.item_ids) ||
    body.item_ids.length === 0 ||
    !body.item_ids.every((id) => Number.isSafeInteger(id) && Number(id) > 0)
  ) {
    return null;
  }

  return {
    submissionUuid: body.submission_uuid,
    itemIds: body.item_ids as number[],
    attemptedUpdate,
  };
};

const FIELD_LABELS: Record<string, string> = {
  material_type: 'material type',
  author: 'author',
  journal: 'journal title',
  publisher: 'publisher',
  isbn: 'ISBN',
  url: 'URL',
  display_start_date: 'display start date',
  display_end_date: 'display end date',
  faculty_notes: 'faculty notes',
  call_number: 'call number',
  barcode: 'barcode',
};

const attemptedItems = (update: Record<string, unknown>): Record<string, unknown>[] =>
  Array.isArray(update.items) ? update.items.filter(isRecord) : [];

export const buildCorrectionSummary = (
  detail: CorrectionRequiredDetail,
  items: Record<string, unknown>[] = attemptedItems(detail.attemptedUpdate)
): string => {
  const affectedItems = detail.itemIds.map((itemId) => {
    const item = items.find((candidate) => String(candidate.item_uuid ?? candidate.backendItemId ?? candidate.id) === String(itemId));
    const title = typeof item?.title === 'string' && item.title.trim() ? item.title.trim() : `Item ${itemId}`;
    const fields = Object.entries(FIELD_LABELS)
      .filter(([key]) => item && typeof item[key] === 'string' && Boolean(item[key]))
      .map(([, label]) => label);

    return `${title} (item ${itemId})${fields.length ? `: proposed details include ${fields.join(', ')}` : ''}`;
  });

  const update = detail.attemptedUpdate;
  const submissionFields = [
    ['submission_notes', 'submission notes'],
    ['needed_by_date', 'needed-by date'],
  ]
    .filter(([key]) => typeof update[key] === 'string' && Boolean(update[key]))
    .map(([, label]) => label);
  const requestedChanges = [
    ...affectedItems,
    ...submissionFields.map((field) => `Submission details: ${field}`),
  ];

  return [
    'Please ask library staff to make these requested corrections to processed reserve items:',
    ...requestedChanges.map((change) => `• ${change}`),
    '',
    'Your proposed changes remain in the draft.',
  ].join('\n');
};

export const handleSubmitFailure = async (
  response: Response,
  reserve: { id: string },
  attemptedUpdate: Record<string, unknown>,
  getErrorMessage: (response: Response) => Promise<string | Error>
): Promise<'locked' | void> => {
  if (response.status === 423) {
    let lockData: { locked_by?: string | null; locked_at?: string | null; lock_reason?: string | null } = {};
    try {
      lockData = await response.json();
    } catch {
      // Preserve the previous fallback for a non-JSON lock response.
    }
    useReserveStore.getState().applyLockState(reserve.id, lockData);
    useDraftStore.getState().deleteDraft(reserve.id);
    const feedback = getSafeErrorFeedback(lockData, 'This submission can no longer be edited');
    notify.error(feedback.message, { reference: feedback.reference });
    return 'locked';
  }

  const correction = await parseCorrectionRequired(response, attemptedUpdate);
  if (correction) throw new CorrectionRequiredError(correction);

  const error = await getErrorMessage(response);
  throw error instanceof Error ? error : new Error(error);
};
