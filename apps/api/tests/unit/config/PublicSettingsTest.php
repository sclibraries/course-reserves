<?php
namespace tests\unit\config;

class PublicSettingsTest extends \Codeception\Test\Unit
{
    private $previous = [];

    protected function _before()
    {
        foreach (['CORS_ALLOWED_ORIGINS', 'EBSCO_PROFILE', 'EBSCO_IP_PREFIXES', 'ADMIN_EMAILS'] as $key) {
            $this->previous[$key] = getenv($key);
            putenv($key);
        }
    }

    protected function _after()
    {
        foreach ($this->previous as $key => $value) {
            putenv($value === false ? $key : $key . '=' . $value);
        }
    }

    public function testUnconfiguredSiteHasNoSitePolicyOrRecipients()
    {
        $params = require codecept_root_dir('config/params.php');
        $this->assertSame([], $params['corsOrigins'] ?? null);
        $this->assertSame('', $params['ebsco']['edsProfile']);
        $this->assertSame([], $params['ebsco']['ipAddresses']);
        $this->assertSame([], $params['adminEmails']);
    }

    public function testPrivateEnvironmentSuppliesSiteSettings()
    {
        putenv('CORS_ALLOWED_ORIGINS= https://app.example.test, ,https://staff.example.test ');
        putenv('EBSCO_PROFILE=synthetic-profile');
        putenv('EBSCO_IP_PREFIXES= 192.0.2, ,198.51.100 ');
        putenv('ADMIN_EMAILS= first@example.test, ,second@example.test ');
        $params = require codecept_root_dir('config/params.php');
        $this->assertSame(['https://app.example.test', 'https://staff.example.test'], $params['corsOrigins'] ?? null);
        $this->assertSame('synthetic-profile', $params['ebsco']['edsProfile']);
        $this->assertSame(['192.0.2', '198.51.100'], $params['ebsco']['ipAddresses']);
        $this->assertSame(['first@example.test', 'second@example.test'], $params['adminEmails']);
    }

    public function testControllersUseConfiguredOriginsAndRetainLocalDevelopment()
    {
        $previous = \Yii::$app->params;
        \Yii::$app->params['corsOrigins'] = ['https://app.example.test'];
        try {
            foreach ([\app\controllers\CourseController::class, \app\controllers\CourseAssignmentsController::class, \app\controllers\ChecklistController::class] as $class) {
                $controller = new $class('test', \Yii::$app);
                $origins = $controller->behaviors()['corsFilter']['cors']['Origin'];
                $this->assertContains('https://app.example.test', $origins);
                $this->assertContains('http://localhost:5173', $origins);
            }
        } finally {
            \Yii::$app->params = $previous;
        }
    }
}
