import { Button } from "@/components/ui/button";
import { DEV_TEST_ACCOUNTS, type DevTestAccount } from "@/config/devTestAccounts";

interface DevTestAccountsProps {
  disabled?: boolean;
  onSelect: (account: DevTestAccount) => void;
}

/** One-click sign-in for the synthetic dev-seed accounts. */
export const DevTestAccounts = ({ disabled, onSelect }: DevTestAccountsProps) => (
  <section aria-label="Test accounts" className="space-y-2 border-t pt-4">
    <h3 className="text-sm font-medium">Test accounts</h3>
    <p className="text-xs text-muted-foreground">
      Created by <code>php yii dev-seed/test-courses</code>. Development only.
    </p>
    <ul className="space-y-2">
      {DEV_TEST_ACCOUNTS.map((account) => (
        <li key={account.internalId} className="flex items-center justify-between gap-3 rounded-md border p-2">
          <div className="text-sm">
            <div className="font-medium">{account.fullName}</div>
            <div className="text-xs text-muted-foreground">
              Internal ID <code>{account.internalId}</code> · {account.description}
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSelect(account)}>
            Sign in
          </Button>
        </li>
      ))}
    </ul>
  </section>
);
