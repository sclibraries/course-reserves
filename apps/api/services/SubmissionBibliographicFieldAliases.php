<?php

namespace app\services;

/** Shared allowlist and alias normalization for source and pending bibliographic fields. */
class SubmissionBibliographicFieldAliases
{
    public const FIELDS = [
        'title' => ['title', 'name', 'book_title', 'article_title', 'website_title'],
        'authors' => ['authors', 'author', 'author_editor', 'director_composer_performer', 'contributors'],
        'publisher' => ['publisher'],
        'publicationYear' => ['publicationYear', 'publication_year', 'publication_date', 'year'],
        'isbn' => ['isbn', 'ISBN'],
        'issn' => ['issn', 'ISSN'],
        'doi' => ['doi', 'DOI'],
        'journalTitle' => ['journalTitle', 'journal_title', 'journal'],
        'volume' => ['volume'],
        'issue' => ['issue'],
        'edition' => ['edition'],
        'pages' => ['pages'],
    ];

    private const OTHER_RESOURCE_DATA_FIELDS = [
        'database' => ['database', 'databaseName', 'database_name'],
        'accession_number' => ['accessionNumber', 'accession_number'],
        'record_url' => ['recordUrl', 'record_url', 'pLink'],
        'url' => ['fullTextUrl', 'url', 'item_url', 'link'],
        'description' => ['description', 'abstract'],
        'display_start_date' => ['displayStartDate', 'startVisibility', 'start_visibility'],
        'display_end_date' => ['displayEndDate', 'endVisibility', 'end_visibility'],
        'use_proxy' => ['useProxy', 'use_proxy'],
    ];

    private const INPUT_FIELDS = [
        'title' => 'title',
        'authors' => 'authors',
        'publisher' => 'publisher',
        'publicationYear' => 'publication_year',
        'isbn' => 'isbn',
        'issn' => 'issn',
        'doi' => 'doi',
    ];

    public static function inputFields()
    {
        $fields = [];
        foreach (self::INPUT_FIELDS as $canonical => $inputField) {
            $fields[$inputField] = self::FIELDS[$canonical];
        }
        return $fields;
    }

    public static function resourceDataFields()
    {
        return array_merge(self::inputFields(), self::OTHER_RESOURCE_DATA_FIELDS);
    }

    public static function canonicalForInput($inputField)
    {
        foreach (self::INPUT_FIELDS as $canonical => $name) {
            if ($name === $inputField) {
                return $canonical;
            }
        }
        return null;
    }

    public static function inputField($canonical)
    {
        return self::INPUT_FIELDS[$canonical] ?? null;
    }

    public static function firstPresent(array $data, $canonical)
    {
        foreach (self::FIELDS[$canonical] as $alias) {
            if (array_key_exists($alias, $data)) {
                return [true, self::normalize($data[$alias])];
            }
        }
        return [false, null];
    }

    public static function allAliases()
    {
        $aliases = [];
        foreach (self::FIELDS as $fieldAliases) {
            $aliases = array_merge($aliases, $fieldAliases);
        }
        return array_values(array_unique($aliases));
    }

    public static function canonicalize(array $values)
    {
        $metadata = array_fill_keys(array_keys(self::FIELDS), null);
        foreach (self::FIELDS as $canonical => $fieldAliases) {
            list($found, $value) = self::firstPresent($values, $canonical);
            if ($found) {
                $metadata[$canonical] = $value;
            }
        }
        return $metadata;
    }

    private static function normalize($value)
    {
        return is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;
    }
}
