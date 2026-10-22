<?php

use app\services\GoogleDocFetcher;
use app\services\GoogleDocUrl;
use app\services\SyllabusException;
use app\services\SyllabusStore;
use app\services\SyllabusUploadValidator;
use Codeception\Test\Unit;

class SyllabusStoreTest extends Unit
{
    public function testGoogleDocIdsComeOnlyFromSecureDocumentPaths()
    {
        $this->assertTrue(class_exists(GoogleDocUrl::class), 'GoogleDocUrl parses validated Google Doc links.');
        $url = 'https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit?usp=sharing';

        $this->assertSame('Abcdefghijklmnopqrstuvwxyz_1234567890', GoogleDocUrl::documentId($url));
        foreach ([
            'http://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit',
            'https://docs.google.com.evil.test/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit',
            'https://docs.google.com@evil.test/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit',
            'https://evil.test/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit',
            'https://docs.google.com/?next=/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit',
        ] as $hostileUrl) {
            $this->assertNull(GoogleDocUrl::documentId($hostileUrl), $hostileUrl);
        }
    }

    public function testUploadTypeIsDeterminedFromBytesAndExtractedTextIsBounded()
    {
        $this->assertTrue(class_exists(SyllabusUploadValidator::class), 'SyllabusUploadValidator checks content bytes.');
        $validator = new SyllabusUploadValidator(1024);
        $pdf = $validator->validate($this->upload("%PDF-1.7\nsynthetic", 'notes.docx'));
        $docx = $validator->validate($this->upload($this->docx(), 'notes.pdf'));

        $this->assertSame('application/pdf', $pdf['mime_type']);
        $this->assertSame(18, $pdf['byte_size']);
        $this->assertSame('application/vnd.openxmlformats-officedocument.wordprocessingml.document', $docx['mime_type']);
        $this->expectException(SyllabusException::class);
        $validator->validate($this->upload('not a PDF or DOCX', 'notes.pdf'));
    }

    public function testUploadSizeAndExtractedTextLimitsAreEnforced()
    {
        $this->assertTrue(class_exists(SyllabusUploadValidator::class), 'SyllabusUploadValidator enforces configured upload limits.');
        $validator = new SyllabusUploadValidator(8);
        $this->expectException(SyllabusException::class);
        $validator->validate($this->upload('%PDF-1.7\nlarge', 'notes.pdf'));
    }

    public function testExtractedTextCannotExceedOneMegabyte()
    {
        $this->assertTrue(class_exists(SyllabusUploadValidator::class), 'SyllabusUploadValidator bounds extracted text.');
        $validator = new SyllabusUploadValidator(1024);
        $this->expectException(SyllabusException::class);
        $validator->validate($this->upload('%PDF-1.7', 'notes.pdf', str_repeat('x', 1048577)));
    }

    public function testUnsharedGoogleDocsMapToAFriendlyError()
    {
        $this->assertTrue(class_exists(GoogleDocFetcher::class), 'GoogleDocFetcher is the injectable HTTP boundary.');
        $this->assertTrue(class_exists(SyllabusStore::class), 'SyllabusStore maps private documents to a friendly error.');
        $fetcher = new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) {
            return [
                'status' => 403,
                'headers' => ['content-type' => 'text/html'],
                'body' => '<html>Sign in</html>',
            ];
        });
        $store = new SyllabusStore($fetcher, sys_get_temp_dir(), 10485760);

        try {
            $store->googleDocText('https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit');
            $this->fail('An unshared Google Doc must be rejected.');
        } catch (SyllabusException $error) {
            $this->assertSame('google_doc_not_shared', $error->getErrorCode());
            $this->assertNotSame('', $error->getReferenceId());
            $this->assertStringContainsString('share', strtolower($error->getMessage()));
        }
    }

    public function testHtmlGoogleSignInPageMapsToNotShared()
    {
        $fetcher = new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) {
            return [
                'status' => 200,
                'headers' => ['content-type' => 'text/html; charset=utf-8'],
                'body' => '<html><body>Sign in</body></html>',
            ];
        });
        $store = new SyllabusStore($fetcher, sys_get_temp_dir(), 10485760);

        try {
            $store->googleDocText('https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit');
            $this->fail('An HTML sign-in response must be treated as a private document.');
        } catch (SyllabusException $error) {
            $this->assertSame('google_doc_not_shared', $error->getErrorCode());
        }
    }

    public function testOtherHtmlGoogleErrorsMapToUnavailable()
    {
        $fetcher = new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) {
            return [
                'status' => 500,
                'headers' => ['content-type' => 'text/html'],
                'body' => '<html><body>Temporary server error</body></html>',
            ];
        });
        $store = new SyllabusStore($fetcher, sys_get_temp_dir(), 10485760);

        try {
            $store->googleDocText('https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit');
            $this->fail('A generic Google error page is unavailable, not evidence of a private document.');
        } catch (SyllabusException $error) {
            $this->assertSame('google_doc_unavailable', $error->getErrorCode());
        }
    }

    public function testRedirectsAreFollowedOnlyToGoogleHosts()
    {
        $this->assertTrue(class_exists(GoogleDocFetcher::class), 'GoogleDocFetcher validates every redirect target.');
        $requests = [];
        $fetcher = new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) use (&$requests) {
            $requests[] = $url;
            return [
                'status' => 302,
                'headers' => ['location' => 'https://attacker.example.test/export'],
                'body' => '',
            ];
        });

        $result = $fetcher->fetch('Abcdefghijklmnopqrstuvwxyz_1234567890');

        $this->assertSame('redirect_host_not_allowed', $result['error']);
        $this->assertCount(1, $requests);
        $this->assertSame(
            'https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/export?format=txt',
            $requests[0]
        );
    }

    public function testRedirectToGoogleusercontentIsFollowed()
    {
        $requests = [];
        $responses = [
            ['status' => 302, 'headers' => ['location' => 'https://doc-123.googleusercontent.com/export'], 'body' => ''],
            ['status' => 200, 'headers' => ['content-type' => 'text/plain'], 'body' => 'Synthetic export'],
        ];
        $fetcher = new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) use (&$requests, &$responses) {
            $requests[] = $url;
            return array_shift($responses);
        });

        $result = $fetcher->fetch('Abcdefghijklmnopqrstuvwxyz_1234567890');

        $this->assertSame('Synthetic export', $result['body']);
        $this->assertCount(2, $requests);
    }

    public function testFetcherStopsAfterThreeRedirects()
    {
        $requests = [];
        $fetcher = new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) use (&$requests) {
            $requests[] = $url;
            return ['status' => 302, 'headers' => ['location' => 'https://docs.google.com/next'], 'body' => ''];
        });

        $result = $fetcher->fetch('Abcdefghijklmnopqrstuvwxyz_1234567890');

        $this->assertSame('redirect_limit_exceeded', $result['error']);
        $this->assertCount(4, $requests);
    }

    public function testFetchedTextOverOneMegabyteIsRejected()
    {
        $fetcher = new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) {
            return [
                'status' => 200,
                'headers' => ['content-type' => 'text/plain'],
                'body' => str_repeat('x', SyllabusUploadValidator::MAX_EXTRACTED_TEXT_BYTES + 1),
            ];
        });
        $store = new SyllabusStore($fetcher, sys_get_temp_dir(), 10485760);

        try {
            $store->googleDocText('https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit');
            $this->fail('Google Doc text over one megabyte must be rejected.');
        } catch (SyllabusException $error) {
            $this->assertSame('syllabus_text_too_large', $error->getErrorCode());
        }
    }

    private function upload($bytes, $filename, $text = 'Synthetic extracted text')
    {
        return [
            'filename' => $filename,
            'mime_type' => 'application/octet-stream',
            'content_base64' => base64_encode($bytes),
            'extracted_text' => $text,
        ];
    }

    private function docx()
    {
        $path = tempnam(sys_get_temp_dir(), 'api094-docx-');
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::OVERWRITE);
        $zip->addFromString('word/document.xml', '<document>synthetic</document>');
        $zip->close();
        $bytes = file_get_contents($path);
        unlink($path);
        return $bytes;
    }
}
