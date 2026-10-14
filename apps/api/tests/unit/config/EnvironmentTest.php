<?php

namespace tests\unit\config;

use app\components\Environment;

class EnvironmentTest extends \Codeception\Test\Unit
{
    private $previous = [];

    protected function _before()
    {
        foreach (Environment::requiredProductionSettings() as $setting) {
            $this->previous[$setting] = getenv($setting);
            putenv($setting . '=test-api054-' . strtolower($setting));
        }
    }

    protected function _after()
    {
        foreach ($this->previous as $setting => $value) {
            putenv($value === false ? $setting : $setting . '=' . $value);
        }
    }

    public function testUnsetAndUnknownEnvironmentDefaultToProduction()
    {
        $this->assertSame('prod', Environment::resolve(false));
        $this->assertSame('prod', Environment::resolve('staging'));
        $this->assertSame('prod', Environment::resolve(''));
    }

    public function testOnlyKnownNonProductionEnvironmentsArePreserved()
    {
        $this->assertSame('dev', Environment::resolve('dev'));
        $this->assertSame('test', Environment::resolve('test'));
        $this->assertSame('prod', Environment::resolve('prod'));
    }

    public function testDebugIsEnabledOnlyForDevelopment()
    {
        foreach (['test', 'prod', 'staging', false] as $environment) {
            $this->assertFalse(Environment::debugEnabled($environment));
        }

        $this->assertTrue(Environment::debugEnabled('dev'));
    }

    public function testProductionSettingsCheckReportsOnlyMissingNames()
    {
        $this->assertSame([], Environment::missingProductionSettings());
        foreach (Environment::requiredProductionSettings() as $setting) {
            putenv($setting . '=');
            $missing = Environment::missingProductionSettings();
            $this->assertSame([$setting], $missing);
            $this->assertStringNotContainsString('test-api054-', implode(' ', $missing));
            putenv($setting . '=test-api054-' . strtolower($setting));
        }
    }

    public function testFixturePermissionIncludesDevelopmentAndTestOnly()
    {
        $this->assertTrue(Environment::allowsTestFixturesFor('dev'));
        $this->assertTrue(Environment::allowsTestFixturesFor('test'));
        $this->assertFalse(Environment::allowsTestFixturesFor('prod'));
        $this->assertFalse(Environment::allowsTestFixturesFor('staging'));
    }
}
