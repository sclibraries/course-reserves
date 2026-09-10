export const EDS_TO_DB_FIELD_MAPPING = {
    book: {
      book_title: "Title",
      author_editor: "Author",
      publisher: "Publisher",
      isbn: "ISBN",
      publication_date: "PublishedDate",
      call_number: "CallNumber",
      is_ebook: "TypePub", // Check if it contains "eBook"
      location: "Location",
    },
    article: {
      article_title: "Title",
      author: "Author",
      journal_title: "Source", // Journal title in EDS
      volume: "Volume",
      issue: "Issue",
      pages: "Pages",
      publication_date: "PublishedDate",
      doi: "DOI",
    },
    media: {
      title: "Title",
      director_composer_performer: "Author", // Sometimes used for composer
      call_number: "CallNumber",
      library_database: "Database",
    },
    website: {
      website_title: "Title",
    }
  };
  