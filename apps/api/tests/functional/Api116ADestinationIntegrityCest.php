<?php

use PHPUnit\Framework\Assert;

class Api116ADestinationIntegrityCest extends Api116ADestinationRegistryTestBase
{
    public function testRegisterOwnedPropagatesNonDuplicateIntegrityException(FunctionalTester $I)
    {
        $pointer = $this->fixtures->createElectronicDestination($this->offering, 'register-integrity-error');
        $item = $this->fixtures->createItem('register-integrity-error-item', $this->offering);
        $outer = \Yii::$app->db->getTransaction();
        if ($outer !== null && $outer->isActive) {
            $outer->commit();
        }
        \Yii::$app->db->createCommand(
            'CREATE TRIGGER ' . $this->triggerName . ' BEFORE INSERT ON publication_destinations '
            . 'FOR EACH ROW SIGNAL SQLSTATE "23000" SET MYSQL_ERRNO = 1452, '
            . 'MESSAGE_TEXT = "Synthetic API-116A unrelated registration integrity error"'
        )->execute();
        try {
            try {
                $this->registry()->registerOwned(Api116AFixture::itemKey($item), $pointer);
                Assert::fail('A non-duplicate integrity error must propagate from registerOwned().');
            } catch (\yii\db\IntegrityException $exception) {
                Assert::assertStringContainsString(
                    'Synthetic API-116A unrelated registration integrity error',
                    $exception->getMessage()
                );
            }
        } finally {
            \Yii::$app->db->createCommand('DROP TRIGGER IF EXISTS ' . $this->triggerName)->execute();
        }
        Assert::assertFalse($this->registryRowForCourseResource($pointer['course_resource_id']));
    }
}
