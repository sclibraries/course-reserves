import { useState } from 'react';

export default function useLazyLoad(fetcher) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetcher();
      setData(result);
      setLoaded(true);
      return result;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, loaded, load };
}
