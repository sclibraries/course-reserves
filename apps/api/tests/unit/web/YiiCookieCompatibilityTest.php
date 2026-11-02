<?php

namespace tests\unit\web;

class YiiCookieCompatibilityTest extends \Codeception\Test\Unit
{
    public function testResponseAndSessionPreserveSameSitePolicies()
    {
        $command = escapeshellarg(PHP_BINARY);
        $fixture = codecept_root_dir('tests/fixtures/cx037-yii-cookie-compatibility.php');
        $command .= ' ' . escapeshellarg($fixture) . ' 2>&1';

        $output = [];
        $exitCode = 0;
        exec($command, $output, $exitCode);

        $outputText = implode("\n", $output);
        $this->assertSame(0, $exitCode, $outputText);

        $captured = json_decode($outputText, true);
        $this->assertNotNull($captured, $outputText);
        $this->assertArrayHasKey('responseCookies', $captured);
        $this->assertArrayHasKey('sessionCookieParams', $captured);
        $this->assertCount(1, $captured['responseCookies']);
        $responseCookieArguments = $captured['responseCookies'][0];
        $sessionCookieParams = $captured['sessionCookieParams'];

        if (PHP_VERSION_ID >= 70300) {
            $this->assertSame('Strict', $responseCookieArguments[2]['sameSite']);
            $this->assertSame('lax', strtolower($sessionCookieParams['samesite']));
            return;
        }

        $this->assertStringContainsString('; samesite=Strict', $responseCookieArguments[3]);
        $this->assertStringContainsString('; samesite=Lax', $sessionCookieParams['path']);
    }
}
