<?php

namespace app\components;

/** Resolves the Five College FOLIO UUID embedded in an EDS accession number. */
class FolioInstanceId
{
    /**
     * @param mixed $accessionNumber
     * @return string|null
     */
    public static function fromAccessionNumber($accessionNumber)
    {
        if (!is_string($accessionNumber)) {
            return null;
        }

        $pattern = '/^scf\.oai\.edge\.fivecolleges\.folio\.ebsco\.com\.fs00001006\.'
            . '([a-f0-9]{8}(?:\.[a-f0-9]{4}){3}\.[a-f0-9]{12})\z/i';
        if (!preg_match($pattern, $accessionNumber, $matches)) {
            return null;
        }

        return str_replace('.', '-', strtolower($matches[1]));
    }
}
