import { create } from 'zustand';

const useCustomizationStore = create((set, get) => ({
  customizations: {
    hampshire: {
      logoUrl: 'https://www.hampshire.edu/themes/custom/hampshire/images/hampshire-logo.svg',
      altText: 'Hampshire College Logo',
      headerBgColor: '#47494C',
      searchButtonBgColor: '#FACA3A',
      resetButtonBgColor: '#6c757d',
      cardBgColor: '#ffffff',
      cardBorderColor: '#dee2e6',
      cardTitleTextColor: '#000000',
      cardTitleFontSize: '1.25rem',
      cardTextColor: '#333333',
      cardButtonBgColor: '#FACA3A',
      recordsCardTitleTextColor: '#000000',
      recordsCardTextColor: '#333333',
      recordsDiscoverLinkText: 'View in Discover',
      recordsDiscoverLinkBgColor: '#000000',
      accordionHeaderBgColor: '#f8f9fa',
      accordionHeaderTextColor: '#000000',
      recordsDiscoverLinkBaseUrl:
        'https://openurl.ebsco.com/c/4e4lys/openurl?sid=ebsco:plink&id=ebsco:cat09206a:scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.',
      moodleLink: 'https://moodle.hampshire.edu',
    },
    mtholyoke: {
      logoUrl:
        'https://lits.mtholyoke.edu/themes/contrib/lits_theme/images/logos/MHC-wordmark-logo.png',
      secondaryText: ' | LTS',
      altText: 'Mount Holyoke College Logo',
      headerBgColor: '#154876',
      searchButtonBgColor: '#2977CC',
      resetButtonBgColor: '#6c757d',
      cardBgColor: '#ffffff',
      cardBorderColor: '#dee2e6',
      cardTitleTextColor: '#000000',
      cardTitleFontSize: '1.25rem',
      cardTextColor: '#333333',
      cardButtonBgColor: '#2977CC',
      recordsCardTitleTextColor: '#000000',
      recordsCardTextColor: '#333333',
      recordsDiscoverLinkText: 'View in Discover Advanced',
      recordsDiscoverLinkBgColor: '#2977CC',
      accordionHeaderBgColor: '#154876',
      accordionHeaderTextColor: '#000000',
      recordsDiscoverLinkBaseUrl:
        'https://search.ebscohost.com/login.aspx?direct=true&AuthType=ip,guest,sso&db=cat09205a&site=eds-live&scope=site&custid=s8884507&groupid=main&AN=mhf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.',
      moodleLink: 'https://moodle.mtholyoke.edu',
    },
    umass: {
      logoUrl:
        'https://www.library.umass.edu/wp-content/uploads/2022/07/UMass_Libraries-256wide-1.png',
      altText: 'UMass Amherst Logo',
      headerBgColor: '#F1F2F3',
      searchButtonBgColor: '#881C1C',
      resetButtonBgColor: '#6c757d',
      cardBgColor: '#ffffff',
      cardBorderColor: '#dee2e6',
      cardTitleTextColor: '#881C1C',
      cardTitleFontSize: '1.25rem',
      cardTextColor: '#333333',
      cardButtonBgColor: '#881C1C',
      recordsCardTitleTextColor: '#000000',
      recordsCardTextColor: '#333333',
      recordsDiscoverLinkText: 'View in Discovery',
      recordsDiscoverLinkBgColor: '#881C1C',
      accordionHeaderBgColor: '#f8f9fa',
      accordionHeaderTextColor: '#000000',
      recordsDiscoverLinkBaseUrl:
        'https://search.ebscohost.com/login.aspx?direct=true&site=eds-live&scope=site&custid=umaah&groupid=main&AuthType=ip,guest,sso&db=cat09207a&AN=umf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.',
      moodleLink: 'https://moodle.umass.edu',
    },
    amherst: {
      logoUrl:
        'https://www.amherst.edu/system/files/styles/original/private/media/LibraryLogoPurpleNightMed.png',
      altText: 'Amherst College Logo',
      headerBgColor: '#33204D',
      searchButtonBgColor: '#5D3C85',
      resetButtonBgColor: '#6c757d',
      cardBgColor: '#ffffff',
      cardBorderColor: '#5D3C85',
      cardTitleTextColor: '#65468B',
      cardTitleFontSize: '1.25rem',
      cardTextColor: '#333333',
      cardButtonBgColor: '#5D3C85',
      recordsCardTitleTextColor: '#000000',
      recordsCardTextColor: '#333333',
      recordsDiscoverLinkText: 'View in Discover',
      recordsDiscoverLinkBgColor: '#5D3C85',
      accordionHeaderBgColor: '#f8f9fa',
      accordionHeaderTextColor: '#ffffff',
      recordsDiscoverLinkBaseUrl:
        'https://search.ebscohost.com/login.aspx?direct=true&AuthType=ip,guest,sso&groupid=main&site=eds-live&scope=site&custid=s8897430&db=cat09203a&AN=acf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.',
      moodleLink: 'https://moodle.amherst.edu',
    },
    smith: {
      logoUrl:
        'https://image-handler.ehost-live.eislz.com/42ece00a-7a45-4339-a39c-10d6e53bd230_1707148879.png',
      altText: 'Smith College Logo',
      headerBgColor: '#F2F2F2',
      searchButtonBgColor: '#287CB1',
      resetButtonBgColor: '#6c757d',
      cardBgColor: '#ffffff',
      cardBorderColor: '#dee2e6',
      cardTitleTextColor: '#388E77',
      cardTitleFontSize: '1.25rem',
      cardTextColor: '#333333',
      cardButtonBgColor: '#287CB1',
      recordsCardTitleTextColor: '#000000',
      recordsCardTextColor: '#333333',
      recordsDiscoverLinkText: 'View in Discover Advanced',
      recordsDiscoverLinkBgColor: '#287CB1',
      accordionHeaderBgColor: '#f8f9fa',
      accordionHeaderTextColor: '#000000',
      recordsDiscoverLinkBaseUrl:
        'https://openurl.ebsco.com/c/4e4lys/openurl?sid=ebsco:plink&id=ebsco:cat09206a:scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.',
      moodleLink: 'https://moodle.smith.edu',
    },
    default: {
      logoUrl: '',
      altText: 'Course Reserves',
      headerBgColor: '#fff',
      searchButtonBgColor: '#007BFF',
      resetButtonBgColor: '#6c757d',
      cardBgColor: '#ffffff',
      cardBorderColor: '#dee2e6',
      cardTitleTextColor: '#000000',
      cardTitleFontSize: '1.25rem',
      cardTextColor: '#333333',
      cardButtonBgColor: '#0d6efd',
      recordsCardTitleTextColor: '#000000',
      recordsCardTextColor: '#333333',
      recordsDiscoverLinkText: 'View in Discover Advanced',
      recordsDiscoverLinkBgColor: '#0d6efd',
      accordionHeaderBgColor: '#f8f9fa',
      accordionHeaderTextColor: '#000000',
      recordsDiscoverLinkBaseUrl: '',
      moodleLink: '', // Or a generic Moodle URL if applicable
    },
  },
  currentCollege: 'default',
  setCollege: (collegeCode) =>
    set((state) => ({
      currentCollege: state.customizations[collegeCode]
        ? collegeCode
        : 'default',
    })),
  getCustomization: () => {
    const state = get();
    return state.customizations[state.currentCollege];
  },
  // Method to determine customization based on reserve location
  getCustomizationByReserve: (reserveLocation) => {
    const state = get();
    if (!reserveLocation) return state.customizations['default'];

    if (reserveLocation.includes('Mount Holyoke College')) {
      return state.customizations['mtholyoke'];
    } else if (reserveLocation.includes('Smith College')) {
      return state.customizations['smith'];
    } else if (reserveLocation.includes('UMass Amherst')) {
      return state.customizations['umass'];
    } else if (reserveLocation.includes('Hampshire College')) {
      return state.customizations['hampshire'];
    } else if (reserveLocation.includes('Amherst College')) {
      return state.customizations['amherst'];
    } else {
      return state.customizations['default'];
    }
  },
  getCustomizationForCollege: (college) => {
    const { customizations } = get();

    if (!college) {
      return customizations.default;
    }

    return customizations[college] || customizations.default;
  },
}));

export default useCustomizationStore;