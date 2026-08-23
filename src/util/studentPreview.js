const PREVIEW_PARAM = 'preview';
const STUDENT_PREVIEW_VALUE = 'student';

export const isStudentPreview = (search = '') => {
  return new URLSearchParams(search).get(PREVIEW_PARAM) === STUDENT_PREVIEW_VALUE;
};

export const withStudentPreview = (search = '', enabled) => {
  const params = new URLSearchParams(search);

  if (enabled) {
    params.set(PREVIEW_PARAM, STUDENT_PREVIEW_VALUE);
  } else {
    params.delete(PREVIEW_PARAM);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const canBypassVisibility = (isAuthenticated, studentPreview) => {
  return Boolean(isAuthenticated && !studentPreview);
};
