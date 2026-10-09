import { MemoryRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/css/App.css';
import '../src/css/index.css';
import 'react-toastify/dist/ReactToastify.css';
import 'react-loading-skeleton/dist/skeleton.css';



const preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;

export const decorators = [
  (Story, context) => {
    if (context.title === 'Core/App') {
      return <Story />;
    }

    return (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    );
  },
];
