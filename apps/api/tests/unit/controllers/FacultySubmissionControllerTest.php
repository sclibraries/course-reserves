<?php

namespace tests\unit\controllers;

use app\controllers\FacultySubmissionController;
use app\services\FacultySubmissionItemUpdateService;
use yii\web\ConflictHttpException;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;

class FacultySubmissionControllerTest extends \Codeception\Test\Unit
{
    public function testMaterialTypesActionUsesExistingMaterialTypesModel()
    {
        $source = file_get_contents(codecept_root_dir('controllers/FacultySubmissionController.php'));

        $this->assertStringContainsString('use app\\models\\MaterialTypes;', $source);
        $this->assertStringContainsString('MaterialTypes::find()', $source);
        $this->assertStringNotContainsString('MaterialType::find()', $source);
    }

    public function testStaffLockContextRequiresStaffOrAdminUserId()
    {
        $controller = new FacultySubmissionController('faculty-submission', \Yii::$app);

        $this->expectException(ForbiddenHttpException::class);

        $this->invokeMethod($controller, 'getStaffLockContext', [
            ['role' => 'staff'],
        ]);
    }

    public function testSubmissionLockConflictRaisesConflict()
    {
        $controller = new FacultySubmissionController('faculty-submission', \Yii::$app);
        $submission = new class {
            public function isLocked()
            {
                return true;
            }
        };

        $this->expectException(ConflictHttpException::class);

        $this->invokeMethod($controller, 'assertSubmissionCanBeLocked', [$submission]);
    }

    public function testSubmissionUnlockConflictRaisesConflict()
    {
        $controller = new FacultySubmissionController('faculty-submission', \Yii::$app);
        $submission = new class {
            public function isLocked()
            {
                return false;
            }
        };

        $this->expectException(ConflictHttpException::class);

        $this->invokeMethod($controller, 'assertSubmissionCanBeUnlocked', [$submission]);
    }

    public function testUpdatedResourceDataPreservesExistingMetadataOnPartialUpdate()
    {
        $service = new FacultySubmissionItemUpdateService();

        $result = $this->invokeMethod($service, 'updatedResourceData', [
            [
                'title' => 'Original title',
                'authors' => 'Original Author',
                'materialType' => 'article',
                'doi' => '10.1000/example',
                'volume' => '12',
                'issue' => '3',
                'pages' => '45-67',
                'citation' => [
                    'source' => 'syllabus',
                ],
            ],
            [
                'title' => 'Updated title',
            ],
        ]);

        $this->assertSame('Updated title', $result['title']);
        $this->assertSame('Original Author', $result['authors']);
        $this->assertSame('article', $result['materialType']);
        $this->assertSame('10.1000/example', $result['doi']);
        $this->assertSame('12', $result['volume']);
        $this->assertSame('3', $result['issue']);
        $this->assertSame('45-67', $result['pages']);
        $this->assertSame(['source' => 'syllabus'], $result['citation']);
    }

    public function testNewResourceDataPreservesNestedResourceDataAndFlatOverrides()
    {
        $service = new FacultySubmissionItemUpdateService();

        $result = $this->invokeMethod($service, 'updatedResourceData', [
            [],
            [
                'resource_data' => [
                    'title' => 'Nested title',
                    'authors' => 'Nested Author',
                    'materialType' => 'book',
                    'edition' => '2nd',
                    'isbn' => '9780000000000',
                    'pages' => '20-27',
                ],
                'title' => 'Flat title',
                'material_type' => 'ebook',
                'assignedPages' => '4-9',
            ],
        ]);

        $this->assertSame('Flat title', $result['title']);
        $this->assertSame('Nested Author', $result['authors']);
        $this->assertSame('ebook', $result['materialType']);
        $this->assertSame('2nd', $result['edition']);
        $this->assertSame('9780000000000', $result['isbn']);
        $this->assertSame('20-27', $result['pages']);
        $this->assertArrayNotHasKey('assignedPages', $result);
    }

    public function testCompleteSubmissionValidationRejectsMissingCourseFields()
    {
        $controller = new FacultySubmissionController('faculty-submission', \Yii::$app);

        $this->expectException(BadRequestHttpException::class);

        $this->invokeMethod($controller, 'validateCompleteSubmissionPayload', [
            [
                'courseCode' => 'ENG 101',
                'courseTitle' => '',
                'term' => '2026SP',
            ],
            [],
        ]);
    }

    public function testCompleteSubmissionValidationRejectsResourceWithoutTitle()
    {
        $controller = new FacultySubmissionController('faculty-submission', \Yii::$app);

        $this->expectException(BadRequestHttpException::class);

        $this->invokeMethod($controller, 'validateCompleteSubmissionPayload', [
            $this->validCourseInfo(),
            [
                [
                    'resource_data' => [
                        'materialType' => 'book',
                    ],
                ],
            ],
        ]);
    }

    public function testCompleteSubmissionValidationRejectsInvalidResourceUrl()
    {
        $controller = new FacultySubmissionController('faculty-submission', \Yii::$app);

        $this->expectException(BadRequestHttpException::class);

        $this->invokeMethod($controller, 'validateCompleteSubmissionPayload', [
            $this->validCourseInfo(),
            [
                [
                    'resource_data' => [
                        'title' => 'Example article',
                        'materialType' => 'article',
                        'url' => 'not a url',
                    ],
                ],
            ],
        ]);
    }

    public function testCompleteSubmissionValidationAllowsValidCourseAndResources()
    {
        $controller = new FacultySubmissionController('faculty-submission', \Yii::$app);

        $this->assertNull($this->invokeMethod($controller, 'validateCompleteSubmissionPayload', [
            $this->validCourseInfo(),
            [
                [
                    'resource_data' => [
                        'title' => 'Example article',
                        'materialType' => 'article',
                        'url' => 'https://example.test/article',
                        'doi' => '10.1000/example',
                    ],
                ],
            ],
        ]));
    }

    private function validCourseInfo()
    {
        return [
            'courseCode' => 'ENG 101',
            'courseTitle' => 'Intro to Literature',
            'term' => '2026SP',
        ];
    }

    private function invokeMethod($object, $methodName, array $arguments = [])
    {
        $reflection = new \ReflectionMethod($object, $methodName);
        $reflection->setAccessible(true);

        return $reflection->invokeArgs($object, $arguments);
    }
}
