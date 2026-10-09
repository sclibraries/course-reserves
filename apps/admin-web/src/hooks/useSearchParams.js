import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useSearchStore from '../store/searchStore';

export function useSearchParams() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    college,
    type,
    query,
    setCollege,
    setType,
    setQuery,
  } = useSearchStore();

  const didMountRef = useRef(false);

  // Parse URL parameters on mount and whenever the URL changes
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);

    const collegeParam = queryParams.get('college') || 'all';
    const typeParam = queryParams.get('type') || 'all';
    const queryParam = queryParams.get('query') || '';

    // Update the store only if parameters have changed
    if (collegeParam !== college) {
      setCollege(collegeParam);
    }
    if (typeParam !== type) {
      setType(typeParam);
    }
    if (queryParam !== query) {
      setQuery(queryParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Update URL parameters when store changes
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const queryParams = new URLSearchParams();

    if (college && college !== 'all') {
      queryParams.set('college', college);
    }
    if (type && type !== 'all') {
      queryParams.set('type', type);
    }
    if (query && query.trim() !== '') {
      queryParams.set('query', query.trim());
    }

    const newSearch = queryParams.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.substring(1) : location.search;

    if (newSearch !== currentSearch) {
      navigate({
        pathname: location.pathname,
        search: `?${newSearch}`,
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [college, type, query]);
}
