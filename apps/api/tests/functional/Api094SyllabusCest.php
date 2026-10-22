<?php

use PHPUnit\Framework\Assert;
use app\services\GoogleDocFetcher;
use app\services\GoogleDocFetcherInterface;
use yii\helpers\FileHelper;

/** Covers JSON syllabus uploads and submission-scoped faculty/staff access. */
class Api094SyllabusCest extends BaseFunctionalCest
{
    private $uuid = '94000000-0000-4000-8000-000000000094';
    private $otherUuid = '94000000-0000-4000-8000-000000000095';
    private $facultyId = 'test-api094-faculty';
    private $facultyToken;
    private $staffToken;
    private $submissionId;
    private $previousFetcherDefinition;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->submissionId = TestSubmissionFixture::create($this->uuid, $this->facultyId);
        TestSubmissionFixture::create($this->otherUuid, 'test-api094-other');
        $this->facultyToken = $this->token($this->facultyId, 'faculty');
        $this->staffToken = $this->token('test-api094-staff', 'staff');
        $this->previousFetcherDefinition = \Yii::$container->getDefinitions()[GoogleDocFetcherInterface::class];
        $this->removeStoredFiles();
    }

    public function _after(FunctionalTester $I)
    {
        TestSubmissionFixture::delete($this->uuid);
        TestSubmissionFixture::delete($this->otherUuid);
        $this->removeStoredFiles();
        \Yii::$container->set(GoogleDocFetcherInterface::class, $this->previousFetcherDefinition);
    }

    public function facultyCannotReadAnotherSubmissionsSyllabi(FunctionalTester $I)
    {
        $this->request($I, 'GET', 'syllabus/faculty-list', [], $this->facultyToken, ['uuid' => $this->otherUuid]);

        $I->seeResponseCodeIs(403);
    }

    public function staffCanReadSyllabiAndFacultyResponsesHideStaffMetadata(FunctionalTester $I)
    {
        $this->request($I, 'POST', 'syllabus/staff-create', $this->upload(), $this->staffToken, ['id' => $this->submissionId]);
        $I->seeResponseCodeIs(201);
        $created = $this->response($I);
        Assert::assertSame('test-api094-staff', $created['added_by']);
        Assert::assertSame('staff', $created['added_by_role']);

        $this->request($I, 'POST', 'syllabus/staff-create', $this->upload('second-syllabus.pdf'), $this->staffToken, [
            'id' => $this->submissionId,
        ]);
        $I->seeResponseCodeIs(201);
        $second = $this->response($I);

        $this->request($I, 'GET', 'syllabus/staff-list', [], $this->staffToken, ['id' => $this->submissionId]);
        $I->seeResponseCodeIs(200);
        $staffSyllabi = $this->response($I)['syllabi'];
        Assert::assertSame(2, count($staffSyllabi));
        Assert::assertSame($second['id'], $staffSyllabi[0]['id']);

        $this->request($I, 'GET', 'syllabus/faculty-list', [], $this->facultyToken, ['uuid' => $this->uuid]);
        $I->seeResponseCodeIs(200);
        $facultySyllabus = $this->response($I)['syllabi'][0];
        Assert::assertArrayNotHasKey('added_by', $facultySyllabus);
        Assert::assertArrayNotHasKey('added_by_role', $facultySyllabus);
        Assert::assertSame('Synthetic extracted text', $facultySyllabus['extracted_text']);
    }

    public function facultyCannotUseStaffSyllabusRoutes(FunctionalTester $I)
    {
        $this->request($I, 'GET', 'syllabus/staff-list', [], $this->facultyToken, ['id' => $this->submissionId]);

        $I->seeResponseCodeIs(403);
    }

    public function googleDocTextRouteUsesTheInjectedFetcherAndStoresNothing(FunctionalTester $I)
    {
        \Yii::$container->set(
            GoogleDocFetcherInterface::class,
            new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) {
                return [
                    'status' => 200,
                    'headers' => ['content-type' => 'text/plain; charset=utf-8'],
                    'body' => 'Synthetic Google Doc text',
                ];
            })
        );
        $this->request($I, 'POST', 'syllabus/google-doc-text', [
            'google_doc_url' => 'https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit',
        ], $this->staffToken, []);

        $I->seeResponseCodeIs(200);
        Assert::assertSame(['extracted_text' => 'Synthetic Google Doc text'], $this->response($I));
        Assert::assertSame(0, (int)\Yii::$app->db->createCommand(
            'SELECT COUNT(*) FROM submission_syllabi WHERE submission_id = :id',
            [':id' => $this->submissionId]
        )->queryScalar());
    }

    public function googleDocLinkStoresItsExportAsTheDownload(FunctionalTester $I)
    {
        \Yii::$container->set(
            GoogleDocFetcherInterface::class,
            new GoogleDocFetcher('https://docs.google.com', function ($url, $timeout) {
                return [
                    'status' => 200,
                    'headers' => ['content-type' => 'text/plain; charset=utf-8'],
                    'body' => 'Synthetic stored Google Doc text',
                ];
            })
        );
        $this->request($I, 'POST', 'syllabus/staff-create', [
            'google_doc_url' => 'https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit?usp=sharing',
        ], $this->staffToken, ['id' => $this->submissionId]);

        $I->seeResponseCodeIs(201);
        $syllabus = $this->response($I);
        Assert::assertSame('google_doc', $syllabus['source']);
        Assert::assertSame(
            'https://docs.google.com/document/d/Abcdefghijklmnopqrstuvwxyz_1234567890/edit',
            $syllabus['source_url']
        );
        Assert::assertSame('Synthetic stored Google Doc text', $syllabus['extracted_text']);
        Assert::assertSame(strlen($syllabus['extracted_text']), $syllabus['byte_size']);

        $this->request($I, 'GET', 'syllabus/staff-file', [], $this->staffToken, [
            'id' => $this->submissionId,
            'sid' => $syllabus['id'],
        ]);

        $I->seeResponseCodeIs(200);
        Assert::assertSame('text/plain', \Yii::$app->response->headers->get('Content-Type'));
        Assert::assertSame('Synthetic stored Google Doc text', \Yii::$app->response->content);
    }

    public function jsonUploadWorksWithoutMultipartAndReturnsExtractedText(FunctionalTester $I)
    {
        $this->request($I, 'POST', 'syllabus/faculty-create', $this->upload(), $this->facultyToken, ['uuid' => $this->uuid]);

        $I->seeResponseCodeIs(201);
        Assert::assertSame('application/pdf', $this->response($I)['mime_type']);
        Assert::assertSame('Synthetic extracted text', $this->response($I)['extracted_text']);
    }

    public function downloadSetsSafeAttachmentHeaders(FunctionalTester $I)
    {
        $this->request($I, 'POST', 'syllabus/faculty-create', $this->upload(), $this->facultyToken, ['uuid' => $this->uuid]);
        $I->seeResponseCodeIs(201);
        $syllabusId = $this->response($I)['id'];

        $this->request($I, 'GET', 'syllabus/faculty-file', [], $this->facultyToken, [
            'uuid' => $this->uuid,
            'sid' => $syllabusId,
        ]);

        $I->seeResponseCodeIs(200);
        $headers = \Yii::$app->response->headers;
        $disposition = $headers->get('Content-Disposition');
        Assert::assertStringContainsString('attachment', strtolower($disposition));
        Assert::assertStringContainsString('synthetic-syllabus.pdf', $disposition);
        Assert::assertSame('application/pdf', $headers->get('Content-Type'));
        Assert::assertSame('nosniff', $headers->get('X-Content-Type-Options'));
        Assert::assertStringContainsString('%PDF-1.7', \Yii::$app->response->content);
    }

    private function request(FunctionalTester $I, $method, $route, array $payload, $token, array $params)
    {
        $I->haveHttpHeader('Authorization', 'Bearer ' . $token);
        $I->sendJsonRequest($method, $route, $payload, $params);
    }

    private function response(FunctionalTester $I)
    {
        $response = $I->grabJsonResponse();
        Assert::assertIsArray($response);
        return $response;
    }

    private function upload($filename = '../synthetic-syllabus.pdf')
    {
        return [
            'filename' => $filename,
            'mime_type' => 'application/octet-stream',
            'content_base64' => base64_encode("%PDF-1.7\nsynthetic syllabus"),
            'extracted_text' => 'Synthetic extracted text',
        ];
    }

    private function token($username, $role)
    {
        $now = time();
        return \Firebase\JWT\JWT::encode([
            'iat' => $now,
            'exp' => $now + 3600,
            'username' => $username,
            'role' => $role,
            'id' => $username,
            'full_name' => 'Synthetic API-094 user',
            'email' => $username . '@example.test',
            'institution' => 'SM',
        ], getenv('JWT_SECRET_KEY'), 'HS256');
    }

    private function removeStoredFiles()
    {
        $path = \Yii::getAlias('@runtime/syllabi');
        if (is_dir($path)) {
            FileHelper::removeDirectory($path);
        }
    }
}
