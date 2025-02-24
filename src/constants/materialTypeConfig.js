// src/constants/materialTypeConfig.js

export const MATERIAL_TYPE_CONFIG = {
    book: {
      label: 'Book / e-Book / Chapter',
      extraFields: [
        { name: 'location', label: 'Location', type: 'text' },
        { name: 'book_title', label: 'Book title', type: 'text' },
        { name: 'author_editor', label: 'Author / editor', type: 'text' },
        { name: 'publisher', label: 'Publisher', type: 'text' },
        { name: 'volume_edition', label: 'Volume / edition', type: 'text' },
        { name: 'isbn', label: 'ISBN', type: 'text' },
        { name: 'publication_date', label: 'Publication date', type: 'text' },
        { name: 'call_number', label: 'Call number', type: 'text' },
        {
          name: 'is_ebook',
          label: 'Is this an e-book?',
          type: 'radio',
          options: ['Yes', 'No']
        },
        {
          name: 'is_personal_copy',
          label: 'Is this a personal copy?',
          type: 'radio',
          options: ['Yes', 'No']
        }
      ]
    },
    article: {
      label: 'Article',
      extraFields: [
        { name: 'location', label: 'Location', type: 'text' },
        { name: 'article_title', label: 'Article title', type: 'text' },
        { name: 'author', label: 'Author', type: 'text' },
        { name: 'journal_title', label: 'Journal title', type: 'text' },
        { name: 'volume', label: 'Volume', type: 'text' },
        { name: 'issue', label: 'Issue', type: 'text' },
        { name: 'pages', label: 'Pages', type: 'text' },
        { name: 'publication_date', label: 'Publication date', type: 'text' },
        { name: 'doi', label: 'DOI', type: 'text' }
      ]
    },
    media: {
      label: 'Media',
      extraFields: [
        { name: 'location', label: 'Location', type: 'text' },
        { name: 'title', label: 'Title', type: 'text' },
        {
          name: 'director_composer_performer',
          label: 'Director / composer / performer',
          type: 'text'
        },
        { name: 'call_number', label: 'Call number', type: 'text' },
        {
          name: 'is_personal_copy',
          label: 'Is this a personal copy?',
          type: 'radio',
          options: ['Yes', 'No']
        },
        { name: 'library_database', label: 'Library database', type: 'text' }
      ]
    },
    website: {
      label: 'Website',
      extraFields: [
        { name: 'website_title', label: 'Website title', type: 'text' }
      ]
    }
  };
  