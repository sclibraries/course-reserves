<?php

namespace app\services;

use Yii;
use yii\helpers\FileHelper;

/** Stores and presents submission syllabi for faculty and staff routes. */
class SyllabusStore
{
    private $googleDocFetcher;
    private $storagePath;
    private $uploadValidator;

    public function __construct(GoogleDocFetcherInterface $googleDocFetcher, $storagePath, $maxUploadBytes)
    {
        $this->googleDocFetcher = $googleDocFetcher;
        $this->storagePath = $storagePath ?: '@runtime/syllabi';
        $this->uploadValidator = new SyllabusUploadValidator($maxUploadBytes);
    }

    public function add($submissionId, array $payload, array $actor)
    {
        if (array_key_exists('google_doc_url', $payload)) {
            if (array_intersect(['filename', 'mime_type', 'content_base64', 'extracted_text'], array_keys($payload))) {
                throw new SyllabusException('Send a Google Doc link or a file, not both.', 'invalid_syllabus', 400);
            }
            return $this->storeGoogleDoc($submissionId, $payload['google_doc_url'], $actor);
        }
        return $this->storeUpload($submissionId, $payload, $actor);
    }

    public function storeUpload($submissionId, array $payload, array $actor)
    {
        $upload = $this->uploadValidator->validate($payload);
        $extension = $upload['mime_type'] === SyllabusUploadValidator::PDF_MIME ? 'pdf' : 'docx';
        return $this->store($submissionId, 'upload', null, null, $upload['original_filename'],
            $upload['mime_type'], $upload['bytes'], $upload['extracted_text'], $extension, $actor);
    }

    public function storeGoogleDoc($submissionId, $url, array $actor)
    {
        $documentId = GoogleDocUrl::documentId($url);
        if ($documentId === null) {
            throw new SyllabusException(
                'Use a Google Docs link in the form https://docs.google.com/document/d/ID/…',
                'invalid_google_doc_url',
                422
            );
        }
        $text = $this->fetchGoogleDocText($documentId);
        $url = GoogleDocUrl::sourceUrl($documentId);
        return $this->store($submissionId, 'google_doc', $documentId, $url, 'syllabus.txt', 'text/plain',
            $text, $text, 'txt', $actor);
    }

    public function googleDocText($url)
    {
        $documentId = GoogleDocUrl::documentId($url);
        if ($documentId === null) {
            throw new SyllabusException('Use a valid secure Google Docs link.', 'invalid_google_doc_url', 422);
        }
        return $this->fetchGoogleDocText($documentId);
    }

    public function listForSubmission($submissionId, $includeStaffData)
    {
        $rows = Yii::$app->db->createCommand(
            'SELECT * FROM submission_syllabi WHERE submission_id = :submission_id ORDER BY id DESC',
            [':submission_id' => (int)$submissionId]
        )->queryAll();
        return ['syllabi' => array_map(function ($row) use ($includeStaffData) {
            return $this->present($row, $includeStaffData);
        }, $rows)];
    }

    public function fileForSubmission($submissionId, $syllabusId)
    {
        $row = Yii::$app->db->createCommand(
            'SELECT * FROM submission_syllabi WHERE submission_id = :submission_id AND id = :id',
            [':submission_id' => (int)$submissionId, ':id' => (int)$syllabusId]
        )->queryOne();
        if (!$row) {
            throw new SyllabusException('Syllabus not found.', 'syllabus_not_found', 404);
        }
        $relativePath = $row['stored_path'];
        if (!preg_match('/^[a-f0-9]{32}\.(pdf|docx|txt)$/', $relativePath)) {
            throw $this->storageFailure(new \RuntimeException('Stored syllabus path is invalid.'));
        }
        try {
            $path = $this->storageDirectory() . DIRECTORY_SEPARATOR . $relativePath;
        } catch (\Exception $error) {
            throw $this->storageFailure($error);
        }
        if (!is_file($path) || !is_readable($path)) {
            throw $this->storageFailure(new \RuntimeException('Stored syllabus file is missing.'));
        }
        $contents = @file_get_contents($path);
        if ($contents === false) {
            throw $this->storageFailure(new \RuntimeException('Stored syllabus file could not be read.'));
        }
        return [
            'contents' => $contents,
            'filename' => $this->safeDownloadFilename($row['original_filename']),
            'mime_type' => $row['mime_type'],
        ];
    }

    private function fetchGoogleDocText($documentId)
    {
        try {
            $result = $this->googleDocFetcher->fetch($documentId);
        } catch (\Exception $error) {
            throw $this->googleDocUnavailable($error->getMessage(), $error);
        }
        $status = (int)($result['status'] ?? 0);
        $headers = $result['headers'] ?? [];
        $contentType = strtolower(trim(explode(';', $headers['content-type'] ?? '', 2)[0]));
        $body = (string)($result['body'] ?? '');
        $isHtml = $contentType === 'text/html' || preg_match('/^\s*<(?:!doctype\s+html|html)\b/i', $body);
        $isSignInPage = $isHtml && preg_match('/(?:accounts\.google\.com|\bsign[\s-]?in\b|\brequest access\b)/i', $body);
        if ($status === 401 || $status === 403 || $isSignInPage) {
            throw $this->googleDocNotShared('HTTP ' . $status . '; content type ' . $contentType);
        }
        if (!empty($result['error']) || $status < 200 || $status >= 300 || $contentType !== 'text/plain') {
            throw $this->googleDocUnavailable(
                $result['detail'] ?? ($result['error'] ?? 'HTTP ' . $status . '; content type ' . $contentType)
            );
        }
        if (strlen($body) > SyllabusUploadValidator::MAX_EXTRACTED_TEXT_BYTES) {
            throw new SyllabusException('Syllabus text exceeds the one megabyte limit.', 'syllabus_text_too_large', 413);
        }
        return $body;
    }

    private function store($submissionId, $source, $documentId, $sourceUrl, $originalFilename,
        $mimeType, $bytes, $text, $extension, array $actor)
    {
        $addedByRole = $this->addedByRole($actor);
        $path = null;
        try {
            $directory = $this->storageDirectory();
            FileHelper::createDirectory($directory, 0700, true);
            $name = bin2hex(random_bytes(16)) . '.' . $extension;
            $path = $directory . DIRECTORY_SEPARATOR . $name;
            $written = @file_put_contents($path, $bytes, LOCK_EX);
            if ($written !== strlen($bytes)) {
                throw new \RuntimeException('Syllabus bytes could not be written completely.');
            }
            @chmod($path, 0600);
            $values = [
                'submission_id' => (int)$submissionId,
                'source' => $source,
                'google_doc_id' => $documentId,
                'source_url' => $sourceUrl,
                'stored_path' => $name,
                'original_filename' => $originalFilename,
                'mime_type' => $mimeType,
                'byte_size' => strlen($bytes),
                'extracted_text' => $text,
                'added_by' => $actor['username'],
                'added_by_role' => $addedByRole,
            ];
            Yii::$app->db->createCommand()->insert('submission_syllabi', $values)->execute();
            $row = Yii::$app->db->createCommand('SELECT * FROM submission_syllabi WHERE id = :id', [
                ':id' => (int)Yii::$app->db->getLastInsertID(),
            ])->queryOne();
            if (!$row) {
                throw new \RuntimeException('Syllabus row was not available after insert.');
            }
            return $this->present($row, $addedByRole === 'staff');
        } catch (\Exception $error) {
            if ($path !== null && is_file($path)) {
                @unlink($path);
            }
            throw $this->storageFailure($error);
        }
    }

    private function present(array $row, $includeStaffData)
    {
        $syllabus = [
            'id' => (int)$row['id'],
            'source' => $row['source'],
            'source_url' => $row['source_url'],
            'original_filename' => $row['original_filename'],
            'mime_type' => $row['mime_type'],
            'byte_size' => (int)$row['byte_size'],
            'extracted_text' => $row['extracted_text'],
            'created_at' => $row['created_at'],
        ];
        if ($includeStaffData) {
            $syllabus['added_by'] = $row['added_by'];
            $syllabus['added_by_role'] = $row['added_by_role'];
        }
        return $syllabus;
    }

    private function storageDirectory()
    {
        $directory = FileHelper::normalizePath(Yii::getAlias($this->storagePath));
        $webRoot = FileHelper::normalizePath(Yii::getAlias('@app/web'));
        if ($directory === $webRoot || strpos($directory, $webRoot . DIRECTORY_SEPARATOR) === 0) {
            throw new \RuntimeException('Syllabus storage must be outside the web root.');
        }
        return $directory;
    }

    private function addedByRole(array $actor)
    {
        if (!empty($actor['username']) && \app\components\Roles::isStaff($actor['role'] ?? null)) {
            return 'staff';
        }
        if (($actor['role'] ?? null) === 'faculty' && !empty($actor['username'])) {
            return 'faculty';
        }
        throw new SyllabusException('An authenticated faculty or staff user is required.', 'invalid_actor', 403);
    }

    private function safeDownloadFilename($filename)
    {
        $safe = preg_replace('/[^A-Za-z0-9._ -]/', '_', basename(str_replace('\\', '/', $filename)));
        $safe = trim($safe, '. ');
        return $safe === '' ? 'syllabus' : $safe;
    }

    private function googleDocNotShared($detail)
    {
        $referenceId = $this->referenceId();
        Yii::warning('Google Doc was not shared; reference ' . $referenceId . ': ' . $detail, 'syllabus');
        return new SyllabusException(
            'This Google Doc is not shared with anyone who has the link. Change its access or upload the file.',
            'google_doc_not_shared',
            422,
            $referenceId
        );
    }

    private function googleDocUnavailable($detail, $previous = null)
    {
        $referenceId = $this->referenceId();
        Yii::error('Google Doc export failed; reference ' . $referenceId . ': ' . $detail, 'syllabus');
        return new SyllabusException(
            'We could not read that Google Doc. Try again or upload the syllabus. Reference: ' . $referenceId,
            'google_doc_unavailable',
            502,
            $referenceId,
            $previous
        );
    }

    private function storageFailure(\Exception $error)
    {
        $referenceId = $this->referenceId();
        Yii::error('Syllabus storage failed; reference ' . $referenceId . ': ' . $error->getMessage(), 'syllabus');
        return new SyllabusException(
            'We could not save or open the syllabus. Contact library staff with reference ' . $referenceId,
            'syllabus_storage_failed',
            500,
            $referenceId,
            $error
        );
    }

    private function referenceId()
    {
        return bin2hex(random_bytes(6));
    }
}
