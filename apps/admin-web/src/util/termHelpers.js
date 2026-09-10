// termHelpers.js
export function getTermName(terms, termId) {
    const termObj = terms.find((t) => t.id === termId);
    return termObj ? termObj.name : 'N/A';
  }
  