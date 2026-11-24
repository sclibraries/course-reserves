<?php

namespace tests\unit\services;

use app\services\FolderNames;
use app\services\SubmissionPayloadService;

class FolderNamesTest extends \Codeception\Test\Unit
{
    /** @dataProvider clashCases */
    public function testClash(array $names, array $reservedOrphanNames, ?array $expected)
    {
        $this->assertSame($expected, FolderNames::clash($names, $reservedOrphanNames));
    }

    public function testUnnamedPayloadFoldersClashAfterNameResolution()
    {
        $this->assertSame([
            'error_code' => 'folder_name_taken',
            'folder_name' => 'Untitled Folder',
            'reason' => 'duplicate',
        ], (new SubmissionPayloadService())->folderNameError(['folders' => [[], []]]));
    }

    public static function clashCases()
    {
        return [
            'trimmed case-insensitive duplicate' => [
                ['Week 1', ' week 1 '], [], ['folder_name' => ' week 1 ', 'reason' => 'duplicate'],
            ],
            'multibyte case-insensitive duplicate' => [
                ['Été', 'été'], [], ['folder_name' => 'été', 'reason' => 'duplicate'],
            ],
            'distinct names without accent folding' => [['Week 1', 'Week 10', 'cafe', 'café'], [], null],
            'blank names' => [[' ', "\t"], [], null],
            'reserved orphan name' => [
                [' week 1 '], ['Week 1'], ['folder_name' => ' week 1 ', 'reason' => 'orphan_name'],
            ],
        ];
    }
}
