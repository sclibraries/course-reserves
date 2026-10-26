import {
  citationToCourseItem,
  discoveryResultToCourseItem,
} from '@course-reserves/citations';

export function groupSyllabusEntries(entries) {
  return entries.reduce((groups, entry, index) => {
    const heading = entry.heading || 'Syllabus items';
    const group = groups.find((item) => item.heading === heading);
    const identifiedEntry = { ...entry, id: `syllabus-entry-${index + 1}` };
    if (group) group.entries.push(identifiedEntry);
    else groups.push({ heading, entries: [identifiedEntry] });
    return groups;
  }, []);
}

export function buildStaffSyllabusPayload({ course, instructorName, instructorUsername, groups, decisions, syllabus }) {
  const folderGroups = groups
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => decisions[entry.id]?.action !== 'drop') }))
    .filter((group) => group.entries.length);
  const folders = folderGroups.map((group, index) => ({
    id: `syllabus-folder-${index + 1}`,
    title: group.heading,
    display_order: index,
  }));
  const items = folderGroups.flatMap((group, folderIndex) => group.entries.map((entry) => {
    const decision = decisions[entry.id];
    const citationItem = decision?.result
      ? discoveryResultToCourseItem(decision.result)
      : citationToCourseItem(entry.text);
    const resourceData = {
      ...citationItem,
      ...(entry.type === 'web' ? { materialType: 'website', url: entry.url } : {}),
      ...(entry.type === 'media' ? { materialType: 'video', ...(entry.url ? { url: entry.url } : {}) } : {}),
      notes: entry.text,
    };
    return {
      resource_data: resourceData,
      folder_uuid: folders[folderIndex].id,
      display_order: itemsDisplayOrder(folderGroups, folderIndex, entry.id),
    };
  }));

  return {
    folio_course_listing_id: course.courseListingId,
    instructor_username: instructorUsername.trim().replace(/@smith\.edu$/iu, ''),
    instructor_display_name: instructorName.trim(),
    courseInfo: {
      courseCode: course.courseNumber,
      courseTitle: course.name,
      section: course.sectionName || course.courseListingObject?.sectionName || '',
      term: course.courseListingObject?.termObject?.name || '',
    },
    folders,
    items,
    syllabus,
  };
}

function itemsDisplayOrder(groups, folderIndex, entryId) {
  return groups.slice(0, folderIndex).reduce((count, group) => count + group.entries.length, 0)
    + groups[folderIndex].entries.findIndex((entry) => entry.id === entryId);
}
