import App from './App.jsx';
import { MemoryRouter } from 'react-router-dom';

export default {
  title: 'Core/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
};

export const Default = {
  render: () => <App router={MemoryRouter} />
};
