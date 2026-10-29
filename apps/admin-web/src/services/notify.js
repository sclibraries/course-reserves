import { toast } from 'sonner';

const AUTO_CLOSE_MS = 5000;

function getReference(error) {
  // Communications/faculty wrappers use reference; WorkflowRequestError uses payload; EDS embeds it in the message.
  const embedded = error?.message?.match(/Reference:\s*([A-Z0-9-]+)/i)?.[1];
  return error?.reference
    || error?.payload?.reference
    || error?.payload?.reference_id
    || embedded;
}

export function toUserError(error, message = 'Something went wrong') {
  return { message, reference: getReference(error) };
}

export const notify = {
  success(message) {
    toast.success(message, { duration: AUTO_CLOSE_MS });
  },
  info(message) {
    toast.info(message, { duration: AUTO_CLOSE_MS });
  },
  warning(message) {
    toast.warning(message, { duration: AUTO_CLOSE_MS });
  },
  error(message, { reference } = {}) {
    const text = message.replace(/[.!?]+$/, '');
    toast.error(reference ? `${text}. Reference: ${reference}` : text, {
      closeButton: true,
      duration: Infinity,
    });
  },
  fromError(error, message = 'Something went wrong') {
    const userError = toUserError(error, message);
    notify.error(userError.message, { reference: userError.reference });
  },
};
