import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert } from '../../ui/alert';
import { Button } from '../../ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '../../ui/card';
import { Label } from '../../ui/label';
import { navPinsService } from '../../../services/admin/navPinsService';
import { groupPropType } from '../../layout/admin-nav/navigationPropTypes';

const MAX_DEFAULT_PINS = 10;

export default function DefaultPinsSettings({ groups, isAdmin }) {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!isAdmin) return undefined;
    let mounted = true;
    navPinsService.getDefaultPins()
      .then((response) => {
        if (mounted) setPins(response.pins);
      })
      .catch(() => {
        if (mounted) setLoadFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [isAdmin]);

  if (!isAdmin) return null;

  const tabs = groups.flatMap((group) => group.tabs);
  const selectedTabs = pins.map((key) => tabs.find((tab) => tab.key === key)).filter(Boolean);

  const togglePin = (key, checked) => {
    setPins((current) => {
      if (checked) {
        return current.length < MAX_DEFAULT_PINS ? [...current, key] : current;
      }
      return current.filter((pin) => pin !== key);
    });
    setSaveError('');
    setStatus('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setStatus('');
    try {
      const response = await navPinsService.saveDefaultPins(pins);
      setPins(response.pins);
      setStatus('Default pins saved.');
    } catch {
      setSaveError('Could not save default pins. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="default-pins-title" className="tw-mt-6 tw-min-w-0">
      <Card>
        <CardHeader>
          <CardTitle id="default-pins-title" className="tw-text-xl">Default pins</CardTitle>
          <CardDescription>These are the pins people see until they choose their own.</CardDescription>
        </CardHeader>
        <CardContent className="tw-min-w-0 tw-space-y-6">
          {loading ? (
            <p role="status">Loading default pins...</p>
          ) : (
            <form onSubmit={save}>
              <div className="tw-grid tw-min-w-0 tw-gap-6 sm:tw-grid-cols-2">
                {groups.map((group) => (
                  <fieldset key={group.key} aria-labelledby={`default-pins-${group.key}`} className="tw-min-w-0">
                    <legend id={`default-pins-${group.key}`} className="tw-mb-2 tw-text-sm tw-font-semibold">
                      {group.label}
                    </legend>
                    <ul className="tw-m-0 tw-list-none tw-space-y-1 tw-p-0">
                      {group.tabs.map((tab) => {
                        const checked = pins.includes(tab.key);
                        const atLimit = !checked && pins.length >= MAX_DEFAULT_PINS;
                        const id = `default-pin-${tab.key}`;
                        return (
                          <li key={tab.key} className="tw-min-w-0">
                            <Label
                              htmlFor={id}
                              className="tw-flex tw-min-h-10 tw-min-w-0 tw-items-center tw-gap-3 tw-rounded-md tw-px-2 tw-py-2 hover:tw-bg-accent/70"
                            >
                              <input
                                id={id}
                                type="checkbox"
                                checked={checked}
                                disabled={saving || loadFailed || atLimit}
                                aria-describedby={atLimit ? 'default-pins-limit' : undefined}
                                onChange={(event) => togglePin(tab.key, event.target.checked)}
                                className="tw-h-5 tw-w-5 tw-shrink-0 tw-accent-primary focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ring"
                              />
                              <span className="tw-min-w-0 tw-break-words">{tab.label}</span>
                            </Label>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                ))}
              </div>

              {pins.length >= MAX_DEFAULT_PINS && (
                <p id="default-pins-limit" role="note" className="tw-mt-3 tw-text-sm tw-text-muted-foreground">
                  Choose up to 10 pages. Remove a selected page to choose another.
                </p>
              )}

              <div className="tw-mt-6 tw-min-w-0">
                <h4 className="tw-text-base tw-font-semibold">Chosen pins in order</h4>
                {selectedTabs.length ? (
                  <ol aria-label="Selected pins in order" className="tw-list-decimal tw-space-y-1 tw-pl-6">
                    {selectedTabs.map((tab) => <li key={tab.key} className="tw-break-words">{tab.label}</li>)}
                  </ol>
                ) : (
                  <p>No default pins selected.</p>
                )}
              </div>

              <Button type="submit" disabled={saving || loading || loadFailed} className="tw-mt-4">
                {saving ? 'Saving...' : 'Save default pins'}
              </Button>
            </form>
          )}
          {loadFailed && <Alert variant="destructive">Could not load default pins. Please try again.</Alert>}
          {saveError && <Alert variant="destructive">{saveError}</Alert>}
          {status && <p role="status" className="tw-text-sm tw-text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>
    </section>
  );
}

DefaultPinsSettings.propTypes = {
  groups: PropTypes.arrayOf(groupPropType).isRequired,
  isAdmin: PropTypes.bool.isRequired,
};
