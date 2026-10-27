export const ACCESS_PATHS = ['purchase', 'ags', 'ill', 'in_house_copy', 'faculty_supplies'];

export const ACCESS_PATH_LABELS = {
  purchase: 'Purchase',
  ags: 'Article Galaxy Scholar',
  ill: 'ILL',
  in_house_copy: 'In-house copy/scan',
  faculty_supplies: 'Faculty supplies a copy',
};

const accessPathErrors = {
  not_claimed_by_you: 'You must hold the claim to set the access path.',
  access_path_not_allowed: 'That access path is not allowed for this item.',
  reason_required: 'Enter a reason before changing the access path.',
  flow_version_missing: 'The flow mapped to this access path has no current version. Ask an admin to update the flow.',
  flow_has_no_steps: 'The flow mapped to this access path has no steps. Ask an admin to update the flow.',
  unknown_flow: 'The mapped workflow could not be found. Ask an admin to update the routing.',
};

export function getAccessPathErrorMessage(error) {
  return accessPathErrors[error?.payload?.error_code]
    || 'The access path could not be saved. Check your connection and try again.';
}

export function getAccessPathRoutingErrorMessage(error) {
  if (error?.payload?.error_code === 'invalid_mapping') {
    return 'Choose a listed flow or None and a listed group or None for each access path.';
  }
  return 'Access path routing could not be saved. Check your connection and try again.';
}

export function getAccessPathNotice(result, flowState, groups) {
  const flowName = flowState?.flow?.name;
  if (result.warning === 'no_flow_mapped') {
    return 'Access path set. No workflow is set up for this path yet; ask an admin to map it.';
  }
  if (result.warning === 'no_group_mapped') {
    return `Access path set. ${flowName ? `Routed to ${flowName}. ` : ''}No group is set up for this path yet; ask an admin to map it.`;
  }

  const groupName = groups?.find((group) => String(group.id) === String(result.group_id))?.name;
  const destinations = [flowName, groupName].filter(Boolean);
  return destinations.length
    ? `Access path set. Routed to ${destinations.join(' and ')}.`
    : 'Access path set.';
}
