<?php

require_once __DIR__ . '/../_support/Api119A2ChecklistFixture.php';

use PHPUnit\Framework\Assert;
use app\models\FacultySubmission;
use app\services\FacultySubmissionItemsReader;

class Api119EItemsReaderCest extends Api109FunctionalCest
{
    private $commandClass;

    public function _before(FunctionalTester $I)
    {
        parent::_before($I);
        $this->commandClass = \Yii::$app->db->commandClass;
        \Yii::$app->db->commandClass = Api119A2FailingCommand::class;
        Api119A2FailingCommand::clearConfiguration();
    }

    public function _after(FunctionalTester $I)
    {
        Api119A2FailingCommand::clearConfiguration();
        \Yii::$app->db->commandClass = $this->commandClass;
        parent::_after($I);
    }

    public function loadsItemsForManySubmissionsWithAConstantSelectCount(FunctionalTester $I)
    {
        $bookId = $this->materialTypeId('book');
        $articleId = $this->materialTypeId('article');
        $sourceId = $this->createSource($bookId);
        $withItems = $this->createSubmission('with-items');
        $empty = $this->createSubmission('empty');
        $newIds = \Yii::$app->db->createCommand()->update('submission_new_resources', [
            'source_resource_id' => (string)$sourceId,
            'staff_material_type_id' => $articleId,
            'display_order' => 1,
            'resource_data' => json_encode(['title' => null]),
        ], ['submission_id' => $withItems])->execute();
        Assert::assertSame(1, $newIds);
        $firstNewId = (int)\Yii::$app->db->createCommand(
            'SELECT id FROM submission_new_resources WHERE submission_id = :id', [':id' => $withItems]
        )->queryScalar();
        \Yii::$app->db->createCommand()->insert('submission_new_resources', [
            'submission_id' => $withItems,
            'source_resource_id' => (string)$sourceId,
            'display_order' => 2,
            'resource_data' => json_encode(['title' => null]),
        ])->execute();
        $secondNewId = (int)\Yii::$app->db->getLastInsertID();
        \Yii::$app->db->createCommand()->insert('submission_reuse_resources', [
            'submission_id' => $withItems,
            'source_resource_id' => $sourceId,
            'display_order' => 3,
            'barcode' => 'synthetic-reuse-barcode',
            'call_number' => 'Synthetic reuse call number',
        ])->execute();
        $reuseId = (int)\Yii::$app->db->getLastInsertID();
        \Yii::$app->db->createCommand()->delete('submission_new_resources', ['submission_id' => $empty])->execute();

        $submissions = FacultySubmission::find()
            ->where(['submission_id' => [$withItems, $empty]])
            ->orderBy(['submission_id' => SORT_ASC])
            ->all();
        $reader = new FacultySubmissionItemsReader();
        $now = date('Y-m-d H:i:s', time() - 300);
        $reader->forSubmissions([$submissions[0]], $now);

        Api119A2FailingCommand::resetQueries();
        Assert::assertSame([], $reader->forSubmissions([], $now));
        Assert::assertSame(0, $this->selectCount());

        Api119A2FailingCommand::resetQueries();
        $single = $reader->forSubmissions([$submissions[0]], $now);
        $singleQueries = $this->selectCount();
        Api119A2FailingCommand::resetQueries();
        $both = $reader->forSubmissions($submissions, $now);
        $bothQueries = $this->selectCount();

        Assert::assertSame([$withItems], array_keys($single));
        Assert::assertSame([$withItems, $empty], array_keys($both));
        Assert::assertSame(['new:' . $firstNewId, 'new:' . $secondNewId, 'reuse:' . $reuseId], array_map(
            function ($item) {
                return $item['kind'] . ':' . $item['id'];
            },
            $both[$withItems]['unfoldered_items']
        ));
        Assert::assertSame('Synthetic API-109 source', $both[$withItems]['unfoldered_items'][0]['title']);
        Assert::assertSame('article', $both[$withItems]['unfoldered_items'][0]['material_type']);
        Assert::assertSame('book', $both[$withItems]['unfoldered_items'][1]['material_type']);
        Assert::assertSame('book', $both[$withItems]['unfoldered_items'][2]['material_type']);
        Assert::assertSame([], $both[$empty]['folders']);
        Assert::assertSame([], $both[$empty]['unfoldered_items']);
        Assert::assertLessThanOrEqual(7, $singleQueries);
        Assert::assertLessThanOrEqual(7, $bothQueries);
        Assert::assertSame($singleQueries, $bothQueries);
    }

    private function selectCount()
    {
        return count(array_filter(Api119A2FailingCommand::queries(), function ($sql) {
            return preg_match('/^\s*SELECT\b/i', $sql);
        }));
    }
}
