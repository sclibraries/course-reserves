/**
 * Synthetic faculty accounts created by `php yii dev-seed/test-courses` (API-078).
 * Shown only on the development mock sign-in form; never real people.
 */
export interface DevTestAccount {
  fullName: string;
  internalId: string;
  description: string;
}

export const DEV_TEST_ACCOUNTS: DevTestAccount[] = [
  {
    fullName: 'Test Faculty A',
    internalId: '999078001',
    description: 'Seeded test courses for the current and upcoming terms',
  },
  {
    fullName: 'Test Faculty B',
    internalId: '999078002',
    description: 'Second faculty member, for designee / acting-for tests',
  },
];
