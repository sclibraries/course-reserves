// hooks/useTermSetup.js
import { useEffect } from 'react';
import useSearchStore from '../store/searchStore';
import { useCurrentTermId } from './useCurrentTermId';

const useTermSetup = (autoSetDefaultTerm = true) => {
  const { termId, terms, loading, error } = useCurrentTermId();
  const setTermId = useSearchStore(state => state.setTermId);
  const setTerms = useSearchStore(state => state.setTerms);
  const selectedTermId = useSearchStore(state => state.termId);

  useEffect(() => {
    if (!loading && terms?.length > 0) {
      setTerms(terms);
      // Only auto-set the default term if autoSetDefaultTerm is true
      if (autoSetDefaultTerm && selectedTermId === null) {
        setTermId(termId);
      }
    }
  }, [loading, terms, termId, selectedTermId, setTerms, setTermId, autoSetDefaultTerm]);

  return { loading, error };
};

export default useTermSetup;
