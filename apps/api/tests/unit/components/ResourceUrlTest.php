<?php

namespace tests\unit\components;

use app\components\ResourceUrl;

class ResourceUrlTest extends \Codeception\Test\Unit
{
    public function testNormalizesFormAcceptedUrlsAndRejectsUnsupportedValues()
    {
        $this->assertTrue(class_exists(ResourceUrl::class), 'The shared resource URL normalizer must exist');

        $cases = [
            [' https://example.org/a b ', 'https://example.org/a%20b'],
            ['http://example.org/a', 'http://example.org/a'],
            ['https://example.org/café', 'https://example.org/caf%C3%A9'],
            ['https://example.org/a|b', 'https://example.org/a%7Cb'],
            ['https://example.org/{a}', 'https://example.org/%7Ba%7D'],
            ['https://example.org/a^"<>\\`', 'https://example.org/a%5E%22%3C%3E%5C%60'],
            ['https://example.org/a%20b', 'https://example.org/a%20b'],
            ['mailto:one@example.org', null],
            ['www.x.org', null],
            ['ftp://example.org/resource', null],
        ];

        foreach ($cases as $case) {
            $this->assertSame($case[1], ResourceUrl::normalize($case[0]));
        }
    }
}
