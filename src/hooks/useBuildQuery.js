export function useBuildQuery(college, key, input, department, sortOption, termId = null) {
  // Sanitize the input (append wildcard if input is provided)
  const sanitizedInput = input ? input.trim() + '*' : '';
  let collegePrefix = '';
  
  // Use the passed termId parameter instead of getting it from store
  // Only include the term filter if termId exists; otherwise, leave it blank.
  const termClause = termId ? ` and courseListing.termId=="${termId}"` : '';

  // Define college prefixes
  switch (college && college.toLowerCase()) {
    case 'smith':
      collegePrefix = 'SC';
      break;
    case 'hampshire':
      collegePrefix = 'HC';
      break;
    case 'mtholyoke':
    case 'mt.holyoke':
      collegePrefix = 'MH';
      break;
    case 'amherst':
      collegePrefix = 'AC';
      break;
    case 'umass':
      collegePrefix = 'UM';
      break;
    default:
      collegePrefix = ''; // No college or 'all' colleges
      break;
  }

  let baseQuery = '';

  // Build the base query using the provided filters.
  const buildBaseQuery = () => {
    if (collegePrefix) {
      // When a college prefix is specified
      if (sanitizedInput) {
        // When there is a search term
        switch (key) {
          case 'all':
            return `(department.name=="${collegePrefix}*" and (name="${sanitizedInput}" or courseNumber="${sanitizedInput}" or sectionName="${sanitizedInput}" or courseListing.instructorObjects="${sanitizedInput}" or courseListing.registrarId="${sanitizedInput}")${termClause})`;
          case 'name':
            return `(department.name=="${collegePrefix}*" and name="${sanitizedInput}"${termClause})`;
          case 'code':
            return `(department.name=="${collegePrefix}*" and courseNumber="${sanitizedInput}"${termClause})`;
          case 'section':
            return `(department.name=="${collegePrefix}*" and sectionName="${sanitizedInput}"${termClause})`;
          case 'instructor':
            return `(department.name=="${collegePrefix}*" and courseListing.instructorObjects="${sanitizedInput}"${termClause})`;
          default:
            return `(department.name=="${collegePrefix}*"${termClause})`;
        }
      } else {
        // When there is no search term, return all records for the college
        return `(department.name=="${collegePrefix}*"${termClause})`;
      }
    } else {
      // When no college prefix is specified
      if (sanitizedInput) {
        // When there is a search term
        switch (key) {
          case 'all':
            return `(name="${sanitizedInput}" or courseNumber="${sanitizedInput}" or sectionName="${sanitizedInput}" or courseListing.instructorObjects="${sanitizedInput}" or courseListing.registrarId="${sanitizedInput}"${termClause})`;
          case 'name':
            return `(name="${sanitizedInput}"${termClause})`;
          case 'code':
            return `(courseNumber="${sanitizedInput}"${termClause})`;
          case 'section':
            return `(sectionName="${sanitizedInput}"${termClause})`;
          case 'instructor':
            return `(courseListing.instructorObjects="${sanitizedInput}"${termClause})`;
          default:
            return `(cql.allRecords=1${termClause})`;
        }
      } else {
        // When there is no search term, return all records
        return `(cql.allRecords=1${termClause})`;
      }
    }
  };

  baseQuery = buildBaseQuery();

  // If a department is specified, refine the query further
  if (department && department.trim() !== '') {
    if (baseQuery.includes('department.name==')) {
      // If the query already contains a department name condition, append an additional filter
      baseQuery = baseQuery.replace(
        /(department\.name=="[^"]*\*")/,
        `$1 and department.name=="${department}"`
      );
    } else {
      // Otherwise, add the department condition from scratch
      baseQuery = `(${baseQuery} and department.name=="${department}")`;
    }
  }

  // If a sortOption is specified, append the sortby clause
  if (sortOption && sortOption.trim() !== '') {
    if (sortOption.includes('.descending')) {
      const field = sortOption.replace('.descending', '');
      baseQuery = `${baseQuery} sortby ${field}/sort.descending`;
    } else {
      baseQuery = `${baseQuery} sortby ${sortOption}`;
    }
  }

  return baseQuery;
}
