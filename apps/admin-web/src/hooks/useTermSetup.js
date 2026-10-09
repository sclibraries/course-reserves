// hooks/useTermSetup.js
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useSearchStore from '../store/searchStore';
import { useCurrentTermId } from './useCurrentTermId';
import { urlParamToTermName } from '../utils/termUrlHelpers';

const useTermSetup = (autoSetDefaultTerm = true) => {
  const { termId, terms, loading, error } = useCurrentTermId();
  const setTermId = useSearchStore(state => state.setTermId);
  const setTerms = useSearchStore(state => state.setTerms);
  const selectedTermId = useSearchStore(state => state.termId);
  const location = useLocation();

  useEffect(() => {
    if (!loading && terms?.length > 0) {
      setTerms(terms);
      
      // Check if URL contains a term parameter
      const queryParams = new URLSearchParams(location.search);
      const urlTermParam = queryParams.get('term');
      
      // Convert URL parameter back to term name if it exists
      const urlTermName = urlTermParam ? urlParamToTermName(urlTermParam) : null;
      
      // Only auto-set the default term if:
      // 1. autoSetDefaultTerm is true
      // 2. no term is selected in the store
      // 3. no term is specified in the URL
      if (autoSetDefaultTerm && selectedTermId === null && !urlTermName) {
        setTermId(termId);
      }
    }
  }, [loading, terms, termId, selectedTermId, setTerms, setTermId, autoSetDefaultTerm, location.search]);

  return { loading, error };
};

export default useTermSetup;
