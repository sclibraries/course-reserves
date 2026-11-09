import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';

export const ResourceFormSection = ({ id, title, icon: Icon, children }) => (
  <section id={id} aria-labelledby={`${id}-title`} className="tw-min-w-0">
    <Card className="tw-mb-4">
      <CardHeader className="tw-p-4">
        <CardTitle id={`${id}-title`} className="tw-flex tw-items-center tw-gap-2 tw-text-lg">
          <Icon aria-hidden="true" className="tw-size-5 tw-shrink-0" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="tw-space-y-4 tw-p-4 tw-pt-0">{children}</CardContent>
    </Card>
  </section>
);

ResourceFormSection.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  children: PropTypes.node,
};
