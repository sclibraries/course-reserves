<?php

namespace tests\unit\services;

use app\services\AccessPathPolicy;

class AccessPathPolicyTest extends \Codeception\Test\Unit
{
    public function testOnlyArticlesAndChaptersGetAllAcquisitionPaths()
    {
        foreach (['article', 'chapter'] as $type) {
            $this->assertSame(AccessPathPolicy::PATHS, AccessPathPolicy::allowedForItem($this->item($type)));
        }
        foreach (['book', 'ebook', 'video', 'website', 'other', 'unrecognized', null] as $type) {
            $this->assertSame(
                ['purchase', 'faculty_supplies'],
                AccessPathPolicy::allowedForItem($this->item($type))
            );
        }
        $this->assertSame(
            ['purchase', 'faculty_supplies'],
            AccessPathPolicy::allowedForItem(['resource_data' => '{invalid json'])
        );
    }

    private function item($type)
    {
        $data = ['title' => 'Synthetic item'];
        if ($type !== null && $type !== 'unrecognized') {
            $data['materialType'] = $type;
        }
        return ['resource_data' => json_encode($data)];
    }
}
