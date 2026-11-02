<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationPublicationProtectionCest extends Api116ADestinationRegistryTestBase
{
    private $originalUrlManager;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->originalUrlManager = \Yii::$app->get('urlManager');
        $webConfig = require codecept_root_dir('config/web.php');
        $urlManagerConfig = $webConfig['components']['urlManager'];
        $urlManagerConfig['class'] = \yii\web\UrlManager::class;
        \Yii::$app->set('urlManager', $urlManagerConfig);
        \Yii::$app->urlManager->showScriptName = false;
    }

    public function _after(FunctionalTester $I)
    {
        try {
            parent::_after($I);
        } finally {
            if ($this->originalUrlManager !== null) {
                \Yii::$app->set('urlManager', $this->originalUrlManager);
                $this->originalUrlManager = null;
            }
        }
    }

    public function testProtectionReadinessGateStillReportsPublicationUnavailable(FunctionalTester $I)
    {
        $itemId = (int)$this->owner['id'];
        $this->claim($I, 'new', $itemId);
        $this->request($I, 'POST', 'workflow-publication/ready', [
            'reason' => 'Synthetic API-116A publication remains disabled',
        ], ['kind' => 'new', 'id' => $itemId]);
        $I->seeResponseCodeIs(200);
        $publication = $this->response($I)['publication'];
        Assert::assertFalse($publication['actions']['can_publish']);
        Assert::assertContains('publication_not_available_yet', $publication['actions']['blockers']);
        $this->assertNoRegistryRowsForItem($this->owner);
    }

    public function testProtectionPublicationRemainsDisabledOnTheFrontendCalledUrl(FunctionalTester $I)
    {
        $itemId = (int)$this->owner['id'];
        $this->fixtures->setMarkers($this->owner, [
            'materialized_resource_id' => null,
            'materialized_course_resource_id' => null,
            'materialized_physical_reference_id' => null,
            'materialized_at' => null,
        ]);
        Assert::assertSame(200, $I->sendApiRequest(
            'POST',
            '/submission-workflow/item/' . $itemId . '/claim',
            $this->staffToken
        ));

        $status = $I->sendApiRequest(
            'POST',
            '/submission-workflow/item/' . $itemId . '/complete-processing',
            $this->staffToken
        );
        Assert::assertSame(409, $status);
        Assert::assertSame('publication_not_available_yet', $this->response($I)['error_code']);
        $this->assertNoRegistryRowsForItem($this->owner);
    }
}
