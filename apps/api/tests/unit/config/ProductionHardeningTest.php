<?php

namespace tests\unit\config;

class ProductionHardeningTest extends \Codeception\Test\Unit
{
    public function testApacheRulesKeepPrivateFilesAndTestEntrypointOutOfProduction()
    {
        $paths = [
            'backend' => codecept_root_dir('.htaccess'),
            'web' => codecept_root_dir('web/.htaccess'),
            'admin' => codecept_root_dir('admin/.htaccess'),
        ];
        foreach ($paths as $path) {
            $this->assertFileExists($path);
        }

        $backendRules = file_get_contents($paths['backend']);
        $webRules = file_get_contents($paths['web']);
        $adminRules = file_get_contents($paths['admin']);

        $this->assertStringContainsString('Options -Indexes', $backendRules);
        $this->assertStringContainsString('Require all denied', $backendRules);
        $this->assertStringContainsString('<FilesMatch "^\.">', $backendRules);
        $this->assertStringContainsString('<If "%{HTTP:Content-Type} =~ m#^multipart/#i">', $backendRules);
        $this->assertStringContainsString('No uploads; PHP2Shell CVE-2026-109618/109619', $backendRules);

        $this->assertStringContainsString('Require all granted', $webRules);
        $this->assertStringContainsString('Options -Indexes', $webRules);
        $this->assertStringContainsString('<Files "index-test.php">', $webRules);
        $this->assertStringContainsString('Require all denied', $webRules);

        $this->assertStringContainsString('<IfModule mod_shib>', $adminRules);
        $this->assertStringNotContainsString('mod_shib.c', $adminRules);
        $this->assertStringContainsString("<IfModule !mod_shib>\n  Require all granted\n</IfModule>", $adminRules);
        $this->assertSame(1, substr_count($adminRules, 'Require all granted'));
        $this->assertStringNotContainsString('Header set Access-Control-Allow-Origin "*"', $adminRules);
        $this->assertStringContainsString('RewriteRule .* https://%{HTTP_HOST}%{REQUEST_URI} [R,L]', $adminRules);
    }
}
