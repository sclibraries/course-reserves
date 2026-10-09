/**
 * HTML sanitization utilities for safely rendering user content
 */

/**
 * Creates a sanitized HTML string for safe rendering
 * This function allows basic HTML tags commonly found in descriptions
 * while removing potentially dangerous elements and attributes
 * 
 * @param {string} htmlString - The HTML string to sanitize
 * @returns {string} Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export const sanitizeHtml = (htmlString) => {
  if (!htmlString || typeof htmlString !== 'string') {
    return '';
  }

  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;

  // Define allowed tags and attributes
  const allowedTags = ['a', 'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'span', 'div'];
  const allowedAttributes = {
    'a': ['href', 'target', 'rel', 'title'],
    'span': ['class'],
    'div': ['class']
  };

  // Function to sanitize a single element
  const sanitizeElement = (element) => {
    const tagName = element.tagName.toLowerCase();
    
    // Remove if tag is not allowed
    if (!allowedTags.includes(tagName)) {
      // Replace with text content
      const textNode = document.createTextNode(element.textContent || '');
      element.parentNode?.replaceChild(textNode, element);
      return;
    }

    // Remove disallowed attributes
    const allowedAttrs = allowedAttributes[tagName] || [];
    const attributes = Array.from(element.attributes);
    
    attributes.forEach(attr => {
      if (!allowedAttrs.includes(attr.name.toLowerCase())) {
        element.removeAttribute(attr.name);
      }
    });

    // Ensure external links have proper security attributes
    if (tagName === 'a') {
      const href = element.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // Recursively sanitize child elements
    Array.from(element.children).forEach(sanitizeElement);
  };

  // Sanitize all elements in the temporary div
  Array.from(tempDiv.children).forEach(sanitizeElement);

  return tempDiv.innerHTML;
};

/**
 * Checks if a string contains HTML tags
 * 
 * @param {string} str - The string to check
 * @returns {boolean} True if the string contains HTML tags
 */
export const containsHtml = (str) => {
  if (!str || typeof str !== 'string') {
    return false;
  }
  return /<[^>]*>/g.test(str);
};
