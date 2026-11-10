import PropTypes from 'prop-types';
import { FileText, Link2, Plus, Tags, Trash2 } from 'lucide-react';
import { Alert } from '../../../ui/alert';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import ProxyToggle from '../common/ProxyToggle';

const ResourceLinks = ({ links, setLinks }) => {
  const addLink = () => setLinks((current) => [...current, {
    url: '',
    title: '',
    description: '',
    use_proxy: false,
    start_visibility: '',
    end_visibility: '',
    use_link_visibility: false,
  }]);

  const removeLink = (indexToRemove) => setLinks((current) => current.filter((_, index) => index !== indexToRemove));
  const updateLink = (index, field, value) => setLinks((current) => current.map((link, linkIndex) => (
    linkIndex === index ? { ...link, [field]: value } : link
  )));

  return (
    <div className="tw-min-w-0 tw-space-y-4">
      <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-justify-between tw-gap-3">
        <h4 className="tw-flex tw-items-center tw-gap-2 tw-font-medium">
          <Link2 aria-hidden="true" className="tw-size-4" /> Additional links
        </h4>
        <Button type="button" size="sm" variant="outline" onClick={addLink}>
          <Plus aria-hidden="true" /> Add link
        </Button>
      </div>

      {links.length === 0 ? (
        <Alert className="tw-text-center">
          <p>No additional links added.</p>
        </Alert>
      ) : (
        <div className="tw-min-w-0 tw-space-y-3">
          {links.map((link, index) => {
            const linkName = link.title?.trim() || link.url?.trim() || 'untitled link';
            return (
              <Card key={index} className="tw-min-w-0">
                <CardHeader className="tw-flex tw-flex-row tw-items-center tw-justify-between tw-gap-2 tw-p-4">
                  <h5 className="tw-min-w-0 tw-break-words tw-font-medium">Link {index + 1}: {linkName}</h5>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove link ${index + 1}: ${linkName}`}
                    onClick={() => removeLink(index)}
                  >
                    <Trash2 aria-hidden="true" /> Remove
                  </Button>
                </CardHeader>
                <CardContent className="tw-grid tw-min-w-0 tw-grid-cols-1 tw-gap-4 tw-p-4 tw-pt-0 md:tw-grid-cols-2">
                  <div className="tw-min-w-0 tw-space-y-2 md:tw-col-span-2">
                    <Label htmlFor={`resource-link-url-${index}`}>
                      <Link2 aria-hidden="true" className="tw-mr-1 tw-inline tw-size-4" /> URL for link {index + 1}
                      {index === 0 && <span aria-hidden="true" className="tw-text-destructive"> *</span>}
                    </Label>
                    <Input
                      id={`resource-link-url-${index}`}
                      type="url"
                      value={link.url}
                      onChange={(event) => updateLink(index, 'url', event.target.value)}
                      placeholder="https://example.com"
                      required={index === 0}
                      className="tw-min-w-0"
                    />
                  </div>
                  <div className="tw-min-w-0 tw-space-y-2">
                    <Label htmlFor={`resource-link-title-${index}`}>
                      <Tags aria-hidden="true" className="tw-mr-1 tw-inline tw-size-4" /> Title for link {index + 1}
                    </Label>
                    <Input
                      id={`resource-link-title-${index}`}
                      value={link.title || ''}
                      onChange={(event) => updateLink(index, 'title', event.target.value)}
                      placeholder="Link title"
                    />
                  </div>
                  <div className="tw-flex tw-items-end">
                    <ProxyToggle
                      name={`resource-link-proxy-${index}`}
                      checked={link.use_proxy || false}
                      onChange={(event) => updateLink(index, 'use_proxy', event.target.checked)}
                      label={`Use proxy for link ${index + 1}`}
                    />
                  </div>
                  <div className="tw-min-w-0 tw-space-y-2 md:tw-col-span-2">
                    <Label htmlFor={`resource-link-description-${index}`}>
                      <FileText aria-hidden="true" className="tw-mr-1 tw-inline tw-size-4" /> Description for link {index + 1}
                    </Label>
                    <Textarea
                      id={`resource-link-description-${index}`}
                      rows={2}
                      value={link.description || ''}
                      onChange={(event) => updateLink(index, 'description', event.target.value)}
                      placeholder="Link description"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {links.length > 0 && (
        <div className="tw-flex tw-justify-center">
          <Button type="button" variant="outline" onClick={addLink}>
            <Plus aria-hidden="true" /> Add another link
          </Button>
        </div>
      )}
    </div>
  );
};

ResourceLinks.propTypes = {
  links: PropTypes.arrayOf(PropTypes.shape({
    url: PropTypes.string.isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    use_proxy: PropTypes.bool,
    start_visibility: PropTypes.string,
    end_visibility: PropTypes.string,
    use_link_visibility: PropTypes.bool,
  })).isRequired,
  setLinks: PropTypes.func.isRequired,
};

export default ResourceLinks;
