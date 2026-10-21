import { expect } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';

expect.extend(matchers);

export async function expectNoAxeViolations(container: Element): Promise<void> {
  expect(await axe(container)).toHaveNoViolations();
}
