<?php
namespace tests\unit\config;

class ShareableConfigTest extends \Codeception\Test\Unit
{
    public function testCookieSigningUsesPrivateConfiguration()
    {
        putenv('COOKIE_VALIDATION_KEY=synthetic-cookie-test-key');
        try {
            $config = require codecept_root_dir('config/web.php');
            $this->assertSame('synthetic-cookie-test-key', $config['components']['request']['cookieValidationKey']);
        } finally {
            putenv('COOKIE_VALIDATION_KEY');
        }
    }

    public function testExportCommandHasNoPrivateDefaultUrl()
    {
        putenv('SPRINGSHARE_EXPORT_URL');
        $command = new \app\commands\FetchSpringshareDataController('fetch-springshare-data', null);
        $this->assertEmpty($command->url);
        $this->assertSame(1, $command->actionIndex());
    }

    public function testExportCommandReadsPrivateUrlFromEnvironment()
    {
        putenv('SPRINGSHARE_EXPORT_URL=https://example.invalid/export?test=1');
        try {
            $command = new \app\commands\FetchSpringshareDataController('fetch-springshare-data', null);
            $this->assertSame('https://example.invalid/export?test=1', $command->url);
        } finally {
            putenv('SPRINGSHARE_EXPORT_URL');
        }
    }
}
