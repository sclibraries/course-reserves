<?php

namespace app\services;

/** Validates JSON-uploaded PDF and DOCX bytes and browser-extracted text. */
class SyllabusUploadValidator
{
    const MAX_EXTRACTED_TEXT_BYTES = 1048576;
    const DEFAULT_MAX_UPLOAD_BYTES = 10485760;
    const PDF_MIME = 'application/pdf';
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    private $maxUploadBytes;

    public function __construct($maxUploadBytes)
    {
        $this->maxUploadBytes = (int)$maxUploadBytes > 0 ? (int)$maxUploadBytes : self::DEFAULT_MAX_UPLOAD_BYTES;
    }

    public function validate(array $payload)
    {
        foreach (['filename', 'mime_type', 'content_base64', 'extracted_text'] as $field) {
            if (!isset($payload[$field]) || !is_string($payload[$field])) {
                throw new SyllabusException(
                    'Provide a filename, file type, base64 file, and extracted text.',
                    'invalid_syllabus',
                    400
                );
            }
        }
        $encoded = $payload['content_base64'];
        if (strlen($encoded) > 4 * (int)ceil($this->maxUploadBytes / 3)) {
            throw $this->tooLarge();
        }
        $bytes = base64_decode($encoded, true);
        if ($bytes === false) {
            throw new SyllabusException('The uploaded file is not valid base64.', 'invalid_syllabus', 400);
        }
        $size = strlen($bytes);
        if ($size > $this->maxUploadBytes) {
            throw $this->tooLarge();
        }
        if (strlen($payload['extracted_text']) > self::MAX_EXTRACTED_TEXT_BYTES) {
            throw new SyllabusException('Syllabus text exceeds the one megabyte limit.', 'syllabus_text_too_large', 413);
        }
        $mimeType = $this->detectMimeType($bytes);
        if ($mimeType === null) {
            throw new SyllabusException('Upload a PDF or DOCX syllabus.', 'unsupported_syllabus_type', 415);
        }
        return [
            'bytes' => $bytes,
            'mime_type' => $mimeType,
            'byte_size' => $size,
            'original_filename' => $this->cleanFilename($payload['filename'], $mimeType),
            'extracted_text' => $payload['extracted_text'],
        ];
    }

    private function detectMimeType($bytes)
    {
        if (substr($bytes, 0, 5) === '%PDF-') {
            return self::PDF_MIME;
        }
        if (substr($bytes, 0, 2) !== 'PK' || !class_exists('ZipArchive')) {
            return null;
        }
        $path = tempnam(sys_get_temp_dir(), 'syllabus-docx-');
        if ($path === false || file_put_contents($path, $bytes) !== strlen($bytes)) {
            if ($path !== false) {
                @unlink($path);
            }
            return null;
        }
        $zip = new \ZipArchive();
        $opened = $zip->open($path);
        $isDocx = $opened === true && $zip->locateName('word/document.xml') !== false;
        if ($opened === true) {
            $zip->close();
        }
        @unlink($path);
        return $isDocx ? self::DOCX_MIME : null;
    }

    private function cleanFilename($filename, $mimeType)
    {
        $filename = basename(str_replace('\\', '/', preg_replace('/[\x00-\x1F\x7F]/', '', $filename)));
        $filename = trim(substr($filename, 0, 255));
        if ($filename === '' || $filename === '.' || $filename === '..') {
            $filename = 'syllabus.' . ($mimeType === self::PDF_MIME ? 'pdf' : 'docx');
        }
        return $filename;
    }

    private function tooLarge()
    {
        return new SyllabusException('Syllabus file exceeds the configured size limit.', 'syllabus_file_too_large', 413);
    }
}
