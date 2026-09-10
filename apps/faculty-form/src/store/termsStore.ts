import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { API_ENDPOINTS, DEFAULT_CONFIG } from '@/config/endpoints';
import { 
  compareTerms, 
  getCurrentTermFromDates, 
  findNextTerm as findNextTermUtil,
  getAvailableTermsForCreation 
} from '@/lib/termUtils';

// Types
export interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  metadata?: {
    createdDate: string;
    createdByUserId: string;
    updatedDate: string;
    updatedByUserId: string;
  };
}

interface TermsResponse {
  message: string;
  code: number;
  data: {
    terms: Term[];
  };
}

interface TermsState {
  // Data
  terms: Term[];
  currentTerm: Term | null;
  nextTerm: Term | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  
  // Actions
  fetchTerms: () => Promise<void>;
  setCurrentTerm: (term: Term) => void;
  getCurrentTermName: () => string;
  getNextTermName: () => string;
  getOrderedTerms: () => Term[];
  getAvailableTerms: () => Term[];
  refreshTermsIfStale: () => Promise<void>;
}



export const useTermsStore = create<TermsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      terms: [],
      currentTerm: null,
      nextTerm: null,
      loading: false,
      error: null,
      lastFetched: null,

      // Fetch terms from FOLIO API
      fetchTerms: async () => {
        set({ loading: true, error: null });
        
        try {
          const url = `${API_ENDPOINTS.FOLIO.BASE_URL}${API_ENDPOINTS.FOLIO.SEARCH_TERMS}`;
          
          console.log('Fetching terms from:', url);
          
          // First try the real API
          let terms: Term[] = [];
          
          try {
            const response = await fetch(url, {
              method: 'GET',
              ...DEFAULT_CONFIG,
              mode: 'cors',
              credentials: 'omit',
            });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data: TermsResponse = await response.json();
            
            if (data.code !== 200 || !data.data?.terms) {
              throw new Error(data.message || 'Invalid response format');
            }
            
            terms = data.data.terms;
            console.log('✅ Successfully fetched terms from API:', terms.length, 'terms');
            
          } catch (apiError) {
            console.warn('⚠️ API fetch failed, using mock data:', apiError);
            
            // Fallback to mock data for development/testing
            terms = [
              {
                id: "e4112ac5-c09a-4351-a938-81445345bd0b",
                name: "2025 Fall",
                startDate: "2025-08-19T04:00:00.000Z",
                endDate: "2025-12-30T05:00:00.000Z"
              },
              {
                id: "823a9c41-32a2-4e8b-b54e-e1439d54822a",
                name: "2026 Winter",
                startDate: "2025-12-12T05:00:00.000Z",
                endDate: "2026-01-26T05:00:00.000Z"
              },
              {
                id: "2c874354-d628-4768-96b9-80ac5da90c7e",
                name: "2026 Spring", 
                startDate: "2026-01-12T05:00:00.000Z",
                endDate: "2026-05-28T04:00:00.000Z"
              },
              {
                id: "5fae9cda-537b-4f42-a3c6-b0540bcdaceb",
                name: "2026 Summer",
                startDate: "2026-05-11T04:00:00.000Z", 
                endDate: "2026-08-26T04:00:00.000Z"
              }
            ];
            console.log('📋 Using mock terms:', terms.length, 'terms');
          }
          
          // Debug logging
          console.log('Terms:', terms.map(t => ({ name: t.name, start: t.startDate, end: t.endDate })));
          
          // Determine current and next terms
          const currentTerm = getCurrentTermFromDates(terms);
          const nextTerm = currentTerm ? findNextTermUtil(terms, currentTerm) : null;
          
          console.log('🎯 Current term:', currentTerm?.name || 'None');
          console.log('➡️ Next term:', nextTerm?.name || 'None');
          
          set({ 
            terms,
            currentTerm,
            nextTerm,
            loading: false,
            error: null,
            lastFetched: Date.now()
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error('❌ Critical error fetching terms:', errorMessage);
          set({ 
            loading: false, 
            error: errorMessage,
            terms: [],
            currentTerm: null,
            nextTerm: null
          });
        }
      },

      // Set current term manually
      setCurrentTerm: (term: Term) => {
        const { terms } = get();
        const nextTerm = findNextTermUtil(terms, term);
        set({ currentTerm: term, nextTerm });
      },

      // Get current term name with fallback
      getCurrentTermName: () => {
        const { currentTerm } = get();
        return currentTerm?.name || '';
      },

      // Get next term name with fallback
      getNextTermName: () => {
        const { nextTerm } = get();
        return nextTerm?.name || '';
      },

      // Get terms ordered by year and season
      getOrderedTerms: () => {
        const { terms } = get();
        return [...terms].sort(compareTerms);
      },

      // Get available terms for course creation (current and future)
      getAvailableTerms: () => {
        const { terms } = get();
        return getAvailableTermsForCreation(terms);
      },

      // Refresh terms if data is stale (older than 1 hour)
      refreshTermsIfStale: async () => {
        const { lastFetched, fetchTerms } = get();
        const oneHour = 60 * 60 * 1000;
        
        if (!lastFetched || (Date.now() - lastFetched) > oneHour) {
          await fetchTerms();
        }
      },
    }),
    {
      name: 'terms-store',
    }
  )
);