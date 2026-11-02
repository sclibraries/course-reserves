<?php

namespace tests\unit\config;

class PhpRuntimeCompatibilityTest extends \Codeception\Test\Unit
{
    public function testRuntimeIsPhp74OrNewer()
    {
        $this->assertGreaterThanOrEqual(
            70400,
            PHP_VERSION_ID,
            'The API test runtime must be PHP 7.4 or newer.'
        );
    }

    public function testComposerPlatformCheckRequiresPhp74OrNewer()
    {
        $platformCheckPath = codecept_root_dir('vendor/composer/platform_check.php');
        $this->assertFileExists($platformCheckPath);

        $platformCheck = file_get_contents($platformCheckPath);
        $this->assertNotFalse($platformCheck);
        preg_match_all('/PHP_VERSION_ID\s*>=\s*(\d+)/', $platformCheck, $matches);

        $this->assertNotEmpty($matches[1], 'Composer platform check must declare a PHP version floor.');
        $requiredVersionId = max(array_map('intval', $matches[1]));
        $this->assertGreaterThanOrEqual(
            70400,
            $requiredVersionId,
            'Generated Composer platform check must require PHP 7.4 or newer.'
        );
    }
}
