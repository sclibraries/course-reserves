import { create } from 'zustand';
import { config } from '../config';

// Default customization values to prevent undefined errors
const defaultCustomization = {
  campusLocation: 'default',
  logoUrl: '/logo-placeholder.png',
  secondaryText: '',
  altText: 'Library Course Reserves',
  headerBgColor: '#ffffff',
  searchButtonBgColor: '#0066cc',
  resetButtonBgColor: '#6c757d',
  cardBgColor: '#ffffff',
  cardBorderColor: '#dee2e6',
  cardTitleTextColor: '#212529',
  cardTitleFontSize: '1.25rem',
  cardTextColor: '#495057',
  cardButtonBgColor: '#0066cc',
  recordsCardTitleTextColor: '#212529',
  recordsCardTextColor: '#495057',
  recordsDiscoverLinkText: 'View in Library Catalog',
  recordsDiscoverLinkBgColor: '#0066cc',
  accordionHeaderBgColor: '#f8f9fa',
  accordionHeaderTextColor: '#212529',
  recordsDiscoverLinkBaseUrl: '',
  moodleLink: '',
  additionalHeaderText: '',
  searchBarBgColor: '#ffffff', // Added for improved searchbar theming
  searchBarTextColor: '#212529', // Added for improved searchbar theming
};

const useCustomizationStore = create((set, get) => {
  console.log('Creating customization store...');
  
  // Initialize with defaults to prevent undefined errors
  return {
    customizations: { 'default': defaultCustomization },
    currentCollege: 'default',
    isLoading: false,
    error: null,

    // Load customizations from backend
    loadCustomizations: async () => {
      console.log('loadCustomizations called');
      set({ isLoading: true, error: null });
      
      const apiUrl = `${config.api.urls.courseReserves}/college-customization`;
      console.log('Fetching customizations from:', apiUrl);
      
      try {
        // Debug the actual URL being called
        console.log('Full URL:', apiUrl);
        console.log('API config:', JSON.stringify(config.api.urls, null, 2));
        
        const authToken = config.api.getAuthToken();
        console.log('Auth token available:', Boolean(authToken));
        
        const response = await fetch(apiUrl, {
          method: 'GET'
        }).catch(err => {
          console.error('Fetch error:', err);
          throw err;
        });

        console.log('Response received:', response ? response.status : 'No response');
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Could not get error text');
          console.error('Error response:', errorText);
          throw new Error(`Error fetching customizations: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Customizations loaded:', data);

        if (!data || !Array.isArray(data) || data.length === 0) {
          console.warn('No customization data received or data is empty');
          // Keep the default but don't overwrite with empty data
          set({ isLoading: false });
          return;
        }

        const customizations = data.reduce((acc, item) => {
          acc[item.campus_location] = {
            campusLocation: item.campus_location,
            logoUrl: item.logo_url || defaultCustomization.logoUrl,
            secondaryText: item.secondary_text || defaultCustomization.secondaryText,
            altText: item.alt_text || defaultCustomization.altText,
            headerBgColor: item.header_bg_color || defaultCustomization.headerBgColor,
            searchButtonBgColor: item.search_button_bg_color || defaultCustomization.searchButtonBgColor,
            resetButtonBgColor: item.reset_button_bg_color || defaultCustomization.resetButtonBgColor,
            cardBgColor: item.card_bg_color || defaultCustomization.cardBgColor,
            cardBorderColor: item.card_border_color || defaultCustomization.cardBorderColor,
            cardTitleTextColor: item.card_title_text_color || defaultCustomization.cardTitleTextColor,
            cardTitleFontSize: item.card_title_font_size || defaultCustomization.cardTitleFontSize,
            cardTextColor: item.card_text_color || defaultCustomization.cardTextColor,
            cardButtonBgColor: item.card_button_bg_color || defaultCustomization.cardButtonBgColor,
            recordsCardTitleTextColor: item.records_card_title_text_color || defaultCustomization.recordsCardTitleTextColor,
            recordsCardTextColor: item.records_card_text_color || defaultCustomization.recordsCardTextColor,
            recordsDiscoverLinkText: item.records_discover_link_text || defaultCustomization.recordsDiscoverLinkText,
            recordsDiscoverLinkBgColor: item.records_discover_link_bg_color || defaultCustomization.recordsDiscoverLinkBgColor,
            accordionHeaderBgColor: item.accordion_header_bg_color || defaultCustomization.accordionHeaderBgColor,
            accordionHeaderTextColor: item.accordion_header_text_color || defaultCustomization.accordionHeaderTextColor,
            recordsDiscoverLinkBaseUrl: item.records_discover_link_base_url || defaultCustomization.recordsDiscoverLinkBaseUrl,
            moodleLink: item.moodle_link || defaultCustomization.moodleLink,
            additionalHeaderText: item.additional_header_text || defaultCustomization.additionalHeaderText,
            searchBarBgColor: item.search_bar_bg_color || defaultCustomization.searchBarBgColor,
            searchBarTextColor: item.search_bar_text_color || defaultCustomization.searchBarTextColor,
          };
          return acc;
        }, { 'default': defaultCustomization }); // Always include default

        set({ customizations, isLoading: false });
        console.log('Customizations stored:', customizations);
      } catch (error) {
        console.error('Failed to load customizations:', error);
        set({ error: error.message, isLoading: false });
      }
    },

    setCollege: (collegeCode) =>
      set((state) => ({
        currentCollege: state.customizations[collegeCode] ? collegeCode : 'default',
      })),

    // Ensure getCustomization always returns valid data
    getCustomization: () => {
      const state = get();
      const college = state.currentCollege;
      console.log('Getting customization for college:', college, 'Available:', Object.keys(state.customizations));
      return state.customizations[college] || state.customizations.default || defaultCustomization;
    },

    getCustomizationByReserve: (reserveLocation) => {
      const state = get();
      if (!reserveLocation) return state.customizations.default;

      if (reserveLocation.includes('Mount Holyoke College')) {
        return state.customizations.mtholyoke;
      } else if (reserveLocation.includes('Smith College')) {
        return state.customizations.smith;
      } else if (reserveLocation.includes('UMass Amherst')) {
        return state.customizations.umass;
      } else if (reserveLocation.includes('Hampshire College')) {
        return state.customizations.hampshire;
      } else if (reserveLocation.includes('Amherst College')) {
        return state.customizations.amherst;
      } else {
        return state.customizations.default;
      }
    },

    getCustomizationForCollege: (college) => {
      const state = get();
      return state.customizations[college] || state.customizations.default;
    },

    setCurrentCollege: (college) => {
      console.log('Setting current college to:', college);
      set({ currentCollege: college });
    },
  };
});

export default useCustomizationStore;
