const bookMapping = {
  book_title: 'title',
  author_editor: 'authors',
  publisher: 'publisher',
  isbn: 'isbns',
  publication_date: 'publicationDate',
  call_number: 'callNumber',
  is_ebook: 'is_ebook',
  location: 'location',
};

export const OTHER_DETAILS = {
  authors: 'author',
  isbns: 'isbn',
  issn: 'issn',
  doi: 'doi',
  publicationDate: 'publication_date',
  journalTitle: 'journal_title',
  volumeNumber: 'volume',
  issueNumber: 'issue',
  pages: 'pages',
  publisher: 'publisher',
  callNumber: 'call_number',
  location: 'location',
  database: 'database',
};

export const EDS_TO_DB_FIELD_MAPPING = {
  book: bookMapping,
  ebook: bookMapping,
  article: {
    article_title: 'title',
    author: 'authors',
    journal_title: 'journalTitle',
    volume: 'volumeNumber',
    issue: 'issueNumber',
    pages: 'pages',
    publication_date: 'publicationDate',
    doi: 'doi',
    issn: 'issn',
  },
  media: {
    title: 'title',
    director_composer_performer: 'authors',
    call_number: 'callNumber',
    library_database: 'database',
  },
  website: {
    website_title: 'title',
  },
};
