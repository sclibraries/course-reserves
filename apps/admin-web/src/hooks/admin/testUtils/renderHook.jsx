import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export async function renderHook(hook, initialProps) {
  let latest;
  let props = initialProps;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  function Harness({ hookProps }) {
    latest = hook(hookProps);
    return null;
  }
  Harness.propTypes = { hookProps: PropTypes.object.isRequired };

  await act(async () => root.render(<Harness hookProps={props} />));
  return {
    get current() { return latest; },
    async rerender(nextProps = props) {
      props = nextProps;
      await act(async () => root.render(<Harness hookProps={props} />));
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}
