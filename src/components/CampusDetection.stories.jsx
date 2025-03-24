import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CampusDetection from './CampusDetection';
import useCustomizationStore from '../store/customizationStore';

/**
 * This is a special type of Storybook story for a component that doesn't render UI.
 * Instead, we display the effect of the component on the application state.
 */
export default {
  title: 'Utilities/CampusDetection',
  component: CampusDetection,
  parameters: {
    // Disable Storybook's automatic actions panel since this component doesn't emit events
    actions: { disable: true },
    docs: {
      description: {
        component: `
CampusDetection is a utility component that detects the user's campus based on:
1. URL query parameter 'college' (highest priority)
2. Existing value in the store
3. IP address detection

Note: This component doesn't render any UI elements.
        `
      }
    }
  },
  decorators: [
    (Story, context) => {
      // Reset the store before each story
      useCustomizationStore.getState().setCurrentCollege('default');
      
      return (
        <div>
          <Story />
          <StateDisplay />
        </div>
      );
    }
  ]
};

/**
 * Helper component to display the current state of the store
 */
const StateDisplay = () => {
  // Subscribe to store changes
  const currentCollege = useCustomizationStore(state => state.currentCollege);
  const collegeName = useCustomizationStore(state => 
    state.getCustomizationForCollege(currentCollege).collegeName || currentCollege);
  
  return (
    <div className="p-4 border rounded mt-3 bg-light">
      <h3 className="h5">Campus Detection Result:</h3>
      <dl className="row mb-0">
        <dt className="col-sm-3">Current College:</dt>
        <dd className="col-sm-9"><code>{currentCollege}</code></dd>
        
        <dt className="col-sm-3">College Name:</dt>
        <dd className="col-sm-9">{collegeName}</dd>
      </dl>
    </div>
  );
};

/**
 * Story showing the component with query parameter college=smith
 */
export const WithQueryParameter = {
  render: () => (
    <MemoryRouter initialEntries={['/search?college=smith']}>
      <Routes>
        <Route path="/search" element={<CampusDetection />} />
      </Routes>
    </MemoryRouter>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows how the component detects the college from the URL query parameter.'
      }
    }
  }
};

/**
 * Story showing the component with IP detection (mocked)
 */
export const WithIPDetection = {
  render: () => (
    <MemoryRouter initialEntries={['/search']}>
      <Routes>
        <Route path="/search" element={<CampusDetection />} />
      </Routes>
    </MemoryRouter>
  ),
  parameters: {
    mockData: {
      ip: '131.229.10.25' // Smith College IP range
    },
    docs: {
      description: {
        story: 'Shows how the component detects the college from the IP address when no query parameter exists.',
        mockFetch: 'The IP detection API call is mocked to return a Smith College IP.'
      }
    }
  }
};

/**
 * Story showing the component with fallback to default
 */
export const WithFallbackToDefault = {
  render: () => (
    <MemoryRouter initialEntries={['/search']}>
      <Routes>
        <Route path="/search" element={<CampusDetection />} />
      </Routes>
    </MemoryRouter>
  ),
  parameters: {
    mockData: {
      ip: '8.8.8.8' // Google DNS IP (not in any college range)
    },
    docs: {
      description: {
        story: 'Shows how the component defaults when the IP is not in any known campus range.'
      }
    }
  }
};