<?php

namespace tests\unit\services;

use app\services\SubmissionOwnershipPolicy;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;

class SubmissionOwnershipPolicyTest extends \Codeception\Test\Unit
{
    public function testOwnerDefaultsToTokenActorWithoutProxyPermission()
    {
        $policy = new SubmissionOwnershipPolicy();

        $owner = $policy->resolveOwner('test-ownership-owner-alpha', null, null);

        $this->assertSame('test-ownership-owner-alpha', $owner['owner_id']);
        $this->assertFalse($owner['is_proxy']);
        $this->assertNull($owner['permission']);
    }

    public function testProxyOwnerRequiresPermission()
    {
        $policy = new SubmissionOwnershipPolicy();

        try {
            $policy->resolveOwner(
                'test-ownership-proxy-no-permission',
                'test-ownership-owner-bravo',
                'test-ownership-listing-current'
            );
            $this->fail('A proxy without a permission must not resolve an owner.');
        } catch (ForbiddenHttpException $exception) {
            $this->assertSame(403, $exception->statusCode);
        }
    }

    public function testOwnerCanAccessTheirSubmission()
    {
        $policy = new SubmissionOwnershipPolicy();
        $submission = (object) ['shibboleth_user_id' => 'test-ownership-owner-alpha'];

        $this->assertTrue($policy->canAccess($submission, 'test-ownership-owner-alpha'));
        $this->assertTrue($policy->canAccess($submission, 'test-ownership-owner-alpha', true));
    }

    public function testUpdateRejectsOwnershipAndCourseIdentityFields()
    {
        $policy = new SubmissionOwnershipPolicy();
        $fields = [
            'shibboleth_user_id',
            'proxy_shibboleth_user_id',
            'proxy_display_name',
            'acting_for_faculty_id',
            'term_code',
            'course_code',
            'section',
            'folio_course_listing_id',
        ];

        foreach ($fields as $field) {
            try {
                $policy->assertUpdateDoesNotChangeOwnership([$field => 'test-forged-value']);
                $this->fail('Expected ownership update rejection for ' . $field);
            } catch (BadRequestHttpException $exception) {
                $this->assertSame(400, $exception->statusCode);
            }
        }

        $this->assertNull(
            $policy->assertUpdateDoesNotChangeOwnership(['submission_notes' => 'test-safe-note'])
        );
    }
}
