import { toast, type ExternalToast } from 'sonner';

type NotifyOptions = Pick<ExternalToast, 'action' | 'duration'>;
type ErrorFeedback = { message: string; reference?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getReference = (error: unknown): string | undefined => {
  if (!isRecord(error)) return undefined;
  const response = isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  const candidate = data?.reference ?? data?.reference_id ?? data?.referenceId ??
    error.reference ?? error.reference_id ?? error.referenceId;

  return typeof candidate === 'string' && /^[A-Za-z0-9-]{4,64}$/.test(candidate)
    ? candidate
    : undefined;
};

export const getSafeErrorFeedback = (error: unknown, message: string): ErrorFeedback => {
  const reference = getReference(error);
  return reference ? { message, reference } : { message };
};

export const notify = {
  success(message: string, options?: NotifyOptions) {
    toast.success(message, options);
  },
  info(message: string, options?: NotifyOptions) {
    toast.info(message, options);
  },
  error(message: string, { reference }: { reference?: string } = {}) {
    toast.error(message, {
      ...(reference ? { description: `Reference: ${reference}` } : {}),
      duration: Infinity,
    });
  },
};
