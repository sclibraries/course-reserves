/**
 * Backend API Changes for Link Visibility Feature
 * ==============================================
 * 
 * These are the key backend changes you'll need to implement to support
 * the new link visibility functionality with your resource_links table.
 */

// 1. UPDATE YOUR RESOURCE SERVICE/CONTROLLER
// ------------------------------------------

/**
 * Update the resource creation/update logic to handle link visibility
 */
async function createOrUpdateResource(resourceData) {
  // Process the main resource data
  const resource = {
    ...resourceData,
    // Only include resource-level visibility if mode is 'record'
    start_visibility: resourceData.visibility_mode === 'record' ? resourceData.start_visibility : null,
    end_visibility: resourceData.visibility_mode === 'record' ? resourceData.end_visibility : null,
    visibility_mode: resourceData.visibility_mode || 'record'
  };

  // Save the resource
  const savedResource = await db.query(
    'INSERT INTO resources (name, item_url, use_proxy, folder_id, description, internal_note, external_note, start_visibility, end_visibility, material_type_id, visibility_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [resource.name, resource.item_url, resource.use_proxy, resource.folder_id, resource.description, resource.internal_note, resource.external_note, resource.start_visibility, resource.end_visibility, resource.material_type_id, resource.visibility_mode]
  );

  // Process additional links with individual visibility dates
  if (resourceData.links && resourceData.links.length > 0) {
    for (const link of resourceData.links) {
      await db.query(
        'INSERT INTO resource_links (resource_id, url, title, description, use_proxy, use_link_visibility, start_visibility, end_visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          savedResource.insertId,
          link.url,
          link.title || null,
          link.description || null,
          link.use_proxy || false,
          link.use_link_visibility || false,
          link.use_link_visibility ? link.start_visibility : null,
          link.use_link_visibility ? link.end_visibility : null
        ]
      );
    }
  }

  return savedResource;
}

// 2. UPDATE YOUR RESOURCE FETCHING LOGIC FOR STUDENTS
// ---------------------------------------------------

/**
 * Update the logic that fetches resources for students to respect link visibility
 */
async function getVisibleResourcesForStudent(courseId) {
  const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  const query = `
    SELECT 
      r.*,
      rl.link_id,
      rl.url,
      rl.title as link_title,
      rl.description as link_description,
      rl.use_proxy as link_use_proxy,
      rl.use_link_visibility,
      rl.start_visibility as link_start_visibility,
      rl.end_visibility as link_end_visibility
    FROM resources r
    LEFT JOIN course_resources cr ON r.resource_id = cr.resource_id
    LEFT JOIN resource_links rl ON r.resource_id = rl.resource_id
    WHERE cr.course_id = ?
    AND (
      -- For record-level visibility, check resource dates
      (r.visibility_mode = 'record' AND (
        (r.start_visibility IS NULL OR r.start_visibility <= ?) AND
        (r.end_visibility IS NULL OR r.end_visibility >= ?)
      ))
      OR
      -- For link-level visibility, always show the resource record
      r.visibility_mode = 'link'
    )
    ORDER BY r.order, r.created_at, rl.order
  `;
  
  const results = await db.query(query, [courseId, currentDate, currentDate]);
  
  // Group by resource and filter links based on their individual visibility
  const resourceMap = new Map();
  
  for (const row of results) {
    if (!resourceMap.has(row.resource_id)) {
      resourceMap.set(row.resource_id, {
        resource_id: row.resource_id,
        name: row.name,
        item_url: row.item_url,
        use_proxy: row.use_proxy,
        description: row.description,
        internal_note: row.internal_note,
        external_note: row.external_note,
        start_visibility: row.start_visibility,
        end_visibility: row.end_visibility,
        material_type_id: row.material_type_id,
        visibility_mode: row.visibility_mode,
        links: []
      });
    }
    
    const resource = resourceMap.get(row.resource_id);
    
    // Add link if it exists and is visible
    if (row.link_id) {
      const isLinkVisible = !row.use_link_visibility || (
        (!row.link_start_visibility || row.link_start_visibility <= currentDate) &&
        (!row.link_end_visibility || row.link_end_visibility >= currentDate)
      );
      
      if (isLinkVisible) {
        resource.links.push({
          link_id: row.link_id,
          url: row.url,
          title: row.link_title,
          description: row.link_description,
          use_proxy: row.link_use_proxy
        });
      }
    }
  }
  
  return Array.from(resourceMap.values());
}

// 3. UPDATE YOUR ADMIN FETCHING LOGIC
// -----------------------------------

/**
 * For admin users, always show all resources and links with visibility info
 */
async function getAllResourcesForAdmin(courseId) {
  const query = `
    SELECT 
      r.*,
      rl.link_id,
      rl.url,
      rl.title as link_title,
      rl.description as link_description,
      rl.use_proxy as link_use_proxy,
      rl.use_link_visibility,
      rl.start_visibility as link_start_visibility,
      rl.end_visibility as link_end_visibility
    FROM resources r
    LEFT JOIN course_resources cr ON r.resource_id = cr.resource_id
    LEFT JOIN resource_links rl ON r.resource_id = rl.resource_id
    WHERE cr.course_id = ?
    ORDER BY r.order, r.created_at, rl.order
  `;
  
  const results = await db.query(query, [courseId]);
  
  // Group by resource
  const resourceMap = new Map();
  
  for (const row of results) {
    if (!resourceMap.has(row.resource_id)) {
      resourceMap.set(row.resource_id, {
        resource_id: row.resource_id,
        name: row.name,
        item_url: row.item_url,
        use_proxy: row.use_proxy,
        description: row.description,
        internal_note: row.internal_note,
        external_note: row.external_note,
        start_visibility: row.start_visibility,
        end_visibility: row.end_visibility,
        material_type_id: row.material_type_id,
        visibility_mode: row.visibility_mode,
        links: []
      });
    }
    
    const resource = resourceMap.get(row.resource_id);
    
    if (row.link_id) {
      resource.links.push({
        link_id: row.link_id,
        url: row.url,
        title: row.link_title,
        description: row.link_description,
        use_proxy: row.link_use_proxy,
        use_link_visibility: row.use_link_visibility,
        start_visibility: row.link_start_visibility,
        end_visibility: row.link_end_visibility
      });
    }
  }
  
  return Array.from(resourceMap.values());
}

// 4. UPDATE RESOURCE CREATION/UPDATE ENDPOINTS
// --------------------------------------------

/**
 * Update existing resource and its links
 */
async function updateResourceWithLinks(resourceId, resourceData) {
  // Update the main resource
  await db.query(
    'UPDATE resources SET name = ?, item_url = ?, use_proxy = ?, folder_id = ?, description = ?, internal_note = ?, external_note = ?, start_visibility = ?, end_visibility = ?, material_type_id = ?, visibility_mode = ? WHERE resource_id = ?',
    [
      resourceData.name,
      resourceData.item_url,
      resourceData.use_proxy,
      resourceData.folder_id,
      resourceData.description,
      resourceData.internal_note,
      resourceData.external_note,
      resourceData.visibility_mode === 'record' ? resourceData.start_visibility : null,
      resourceData.visibility_mode === 'record' ? resourceData.end_visibility : null,
      resourceData.material_type_id,
      resourceData.visibility_mode || 'record',
      resourceId
    ]
  );

  // Delete existing links
  await db.query('DELETE FROM resource_links WHERE resource_id = ?', [resourceId]);

  // Insert new links
  if (resourceData.links && resourceData.links.length > 0) {
    for (const link of resourceData.links) {
      await db.query(
        'INSERT INTO resource_links (resource_id, url, title, description, use_proxy, use_link_visibility, start_visibility, end_visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          resourceId,
          link.url,
          link.title || null,
          link.description || null,
          link.use_proxy || false,
          link.use_link_visibility || false,
          link.use_link_visibility ? link.start_visibility : null,
          link.use_link_visibility ? link.end_visibility : null
        ]
      );
    }
  }

  return { success: true };
}

// 5. VALIDATION FUNCTIONS
// -----------------------

/**
 * Validate link visibility dates
 */
function validateLinkVisibility(link) {
  if (link.use_link_visibility) {
    if (link.start_visibility && link.end_visibility) {
      const startDate = new Date(link.start_visibility);
      const endDate = new Date(link.end_visibility);
      
      if (startDate >= endDate) {
        throw new Error(`Link "${link.title || link.url}" has invalid date range: start date must be before end date`);
      }
    }
  }
  
  return true;
}

/**
 * Validate resource visibility configuration
 */
function validateResourceVisibility(resource) {
  // If using record-level visibility, ensure dates are valid
  if (resource.visibility_mode === 'record' && resource.start_visibility && resource.end_visibility) {
    const startDate = new Date(resource.start_visibility);
    const endDate = new Date(resource.end_visibility);
    
    if (startDate >= endDate) {
      throw new Error('Resource visibility start date must be before end date');
    }
  }
  
  // Validate all links
  if (resource.links) {
    for (const link of resource.links) {
      validateLinkVisibility(link);
    }
  }
  
  return true;
}

// Example usage in your Express routes:
/*
app.post('/api/resources', async (req, res) => {
  try {
    validateResourceVisibility(req.body);
    const result = await createOrUpdateResource(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/resources/:id', async (req, res) => {
  try {
    validateResourceVisibility(req.body);
    const result = await updateResourceWithLinks(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/courses/:courseId/resources', async (req, res) => {
  try {
    const isAdmin = req.user && req.user.isAdmin; // Your auth logic here
    const resources = isAdmin 
      ? await getAllResourcesForAdmin(req.params.courseId)
      : await getVisibleResourcesForStudent(req.params.courseId);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
*/

module.exports = {
  createOrUpdateResource,
  updateResourceWithLinks,
  getVisibleResourcesForStudent,
  getAllResourcesForAdmin,
  validateLinkVisibility,
  validateResourceVisibility
};
