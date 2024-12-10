export function useBuildQuery(college, key, input, department, sortOption) {
    const sanitizedInput = input ? input.trim() + '*' : '';
    let collegePrefix = '';
  
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
  
    const buildBaseQuery = () => {
      if (collegePrefix) {
        // When a college prefix is specified
        if (sanitizedInput) {
          // When there is a search term
          switch (key) {
            case 'all':
              return `(department.name=="${collegePrefix}*" and (name="${sanitizedInput}" or courseNumber="${sanitizedInput}" or sectionName="${sanitizedInput}" or courseListing.instructorObjects="${sanitizedInput}" or courseListing.registrarId="${sanitizedInput}"))`;
            case 'name':
              return `(department.name=="${collegePrefix}*" and name="${sanitizedInput}")`;
            case 'code':
              return `(department.name=="${collegePrefix}*" and courseNumber="${sanitizedInput}")`;
            case 'section':
              return `(department.name=="${collegePrefix}*" and sectionName="${sanitizedInput}")`;
            case 'instructor':
              return `(department.name=="${collegePrefix}*" and courseListing.instructorObjects="${sanitizedInput}")`;
            default:
              return `(department.name=="${collegePrefix}*")`;
          }
        } else {
          // When there is no search term, return all records for the college
          return `(department.name=="${collegePrefix}*")`;
        }
      } else {
        // When no college prefix is specified
        if (sanitizedInput) {
          // When there is a search term
          switch (key) {
            case 'all':
              return `(name="${sanitizedInput}" or courseNumber="${sanitizedInput}" or sectionName="${sanitizedInput}" or courseListing.instructorObjects="${sanitizedInput}" or courseListing.registrarId="${sanitizedInput}")`;
            case 'name':
              return `(name="${sanitizedInput}")`;
            case 'code':
              return `(courseNumber="${sanitizedInput}")`;
            case 'section':
              return `(sectionName="${sanitizedInput}")`;
            case 'instructor':
              return `(courseListing.instructorObjects="${sanitizedInput}")`;
            default:
              return '(cql.allRecords=1)';
          }
        } else {
          // When there is no search term, return all records
          return '(cql.allRecords=1)';
        }
      }
    };
  
    baseQuery = buildBaseQuery();
  
    // If a department is specified, refine the query further
    // If we already have a college prefix condition for department,
    // we add the chosen department with an additional AND condition
    // Otherwise, we add the department condition from scratch.
    if (department && department.trim() !== '') {
      // Check if baseQuery already contains a department condition
      // If collegePrefix is present, we likely have `(department.name=="${collegePrefix}*")`
      // We can just AND the specific department name to refine the results.
      // If no collegePrefix, we need to AND this department filter into the query.
      if (baseQuery.includes('department.name==')) {
        // Already have a department name condition with prefix
        // Add department name after the prefix condition
        baseQuery = baseQuery.replace(
          /(department\.name=="[^"]*\*")/,
          `$1 and department.name=="${department}"`
        );
      } else {
        // No department condition yet, add it:
        // If baseQuery is allRecords or something else, we AND the department condition.
        // Make sure to wrap in parentheses if needed.
        baseQuery = `(${baseQuery} and department.name=="${department}")`;
      }
    }
  
    // If a sortOption is specified, append the sortby clause
    if (sortOption && sortOption.trim() !== '') {
      // If sortOption contains ".descending", we assume format: "field.descending"
      // Otherwise it's ascending by default
      if (sortOption.includes('.descending')) {
        const field = sortOption.replace('.descending', '');
        baseQuery = `${baseQuery} sortby ${field}/sort.descending`;
      } else {
        baseQuery = `${baseQuery} sortby ${sortOption}`;
      }
    }
  
    return baseQuery;
  }
  