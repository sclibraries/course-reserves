<?php

use PHPUnit\Framework\Assert;
use app\services\PublicationDestinationRegistry;
use app\services\Transactional;

class Api116ADestinationAttachRecoveryCest extends Api116ADestinationRegistryTestBase
{
    public function testAttachRecoversPointerDuplicateAndReturnsWinningDestination(FunctionalTester $I)
    {
        $item = $this->fixtures->createItem('attach-recovery-item', $this->offering);
        $pointer = $this->fixtures->createElectronicDestination($this->offering, 'attach-recovery-live');
        $destinationId = $this->insertDestination($pointer);
        $registry = new class(\Yii::$app->db) extends PublicationDestinationRegistry {
            private $hiddenPointerReads = 2;

            protected function destinationForPointer(array $pointer, $forUpdate = false)
            {
                if (!$forUpdate && $this->hiddenPointerReads > 0) {
                    $this->hiddenPointerReads--;
                    return null;
                }
                return parent::destinationForPointer($pointer, $forUpdate);
            }
        };

        $result = Transactional::run(function () use ($registry, $item, $pointer) {
            return $registry->attach(Api116AFixture::itemKey($item), $pointer);
        });

        $this->success($result);
        $attachment = $this->attachmentRows($item)[0];
        Assert::assertSame($destinationId, (int)$result['body']['attachment']['destination_id']);
        Assert::assertSame((int)$result['body']['attachment']['id'], (int)$attachment['id']);
        Assert::assertSame($destinationId, (int)$attachment['destination_id']);
    }
}
