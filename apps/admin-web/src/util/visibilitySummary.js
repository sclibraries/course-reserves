import {
  formatVisibilityDate,
  getItemVisibility,
  isLinkVisible,
  isPrimaryLinkVisible,
} from './resourceVisibility';
import { isVideoMaterialType } from './edsMaterialType';
import { serializeResourcePayload } from './resourcePayload';

const isPresent = (value) => Boolean(value && value.trim());
const linkMessage = (visible) => (visible ? 'Visible to students now' : 'Not visible to students now');

const citationMessage = (resource, visibility) => {
  if (isVideoMaterialType(resource.material_type_id) && (resource.start_visibility || resource.end_visibility)) {
    const start = formatVisibilityDate(resource.start_visibility, 'start') || 'any time';
    const end = formatVisibilityDate(resource.end_visibility, 'end') || 'any time';
    return `Term dates applied: ${start} to ${end}`;
  }
  if (visibility.endDate) return `Ended ${formatVisibilityDate(visibility.endDate, 'end')}`;
  return visibility.message || 'Visible to students now';
};

export const getVisibilitySummary = (formData, { mode = 'course', sourceType, course, courseResourceId } = {}) => {
  const resource = serializeResourcePayload(formData, {
    isEdit: sourceType === 'edit', mode, course, courseResourceId,
  });
  const citationVisibility = mode === 'none'
    ? null
    : getItemVisibility({ isElectronic: true, resource }, false);
  let primaryLink = null;
  let citation = null;

  if (citationVisibility) {
    citation = citationMessage(resource, citationVisibility);
    if (!isPresent(resource.link)) {
      primaryLink = 'No primary link';
    } else {
      const primaryResource = { ...resource };
      delete primaryResource.use_resource_visibility;
      primaryLink = linkMessage(isPrimaryLinkVisible(primaryResource, false));
    }
  }

  const links = !citationVisibility || citationVisibility.isVisible
    ? (resource.links || [])
      .filter((link) => isPresent(link.url))
      .map((link, index) => ({
        title: link.title || `Link ${index + 1}`,
        message: linkMessage(isLinkVisible(link, false)),
      }))
    : [];

  return {
    citation,
    primaryLink,
    links,
    sharedDatesMessage: mode === 'none'
      ? (links.length ? "Cross-linked pages use this resource's shared dates" : null)
      : "Cross-linked pages use this resource's shared dates",
  };
};
