<?php

namespace tests\unit\services;

use app\services\SafeRedirect;

class SafeRedirectTest extends \Codeception\Test\Unit
{
    private $defaultRedirect = 'https://libtools2.smith.edu/course-reserves/faculty';

    public function testAllowsConfiguredFacultyFormOrigin()
    {
        $target = 'https://faculty.example.test/course-reserves/faculty?next=materials';

        $this->assertSame(
            $target,
            $this->resolve($target, 'https://faculty.example.test/course-reserves/', [])
        );
    }

    public function testAllowsOriginFromCorsAllowList()
    {
        $target = 'https://admin.example.test/course-reserves/faculty';

        $this->assertSame(
            $target,
            $this->resolve($target, null, ['https://admin.example.test'])
        );
    }

    public function testRejectsAnOtherAbsoluteOrigin()
    {
        $this->assertSame(
            $this->defaultRedirect,
            $this->resolve('https://attacker.example.test/phishing')
        );
    }

    public function testRejectsOriginsWithDifferentSchemeOrPort()
    {
        $this->assertSame(
            $this->defaultRedirect,
            $this->resolve(
                'http://faculty.example.test/path',
                null,
                ['https://faculty.example.test']
            )
        );
        $this->assertSame(
            $this->defaultRedirect,
            $this->resolve(
                'https://faculty.example.test:9443/path',
                null,
                ['https://faculty.example.test:8443']
            )
        );
    }

    public function testRejectsProtocolRelativeAndBackslashPaths()
    {
        foreach (['//attacker.example.test/path', '/\\attacker.example.test/path'] as $target) {
            $this->assertSame($this->defaultRedirect, $this->resolve($target));
        }
    }

    public function testResolvesRelativePathAgainstCurrentHost()
    {
        $this->assertSame(
            'http://localhost:8080/course-reserves/faculty?source=login',
            $this->resolve('/course-reserves/faculty?source=login', null, [], 'http', 'localhost:8080')
        );
    }

    public function testIgnoresRefererWhenResolvingRelativePath()
    {
        $previousReferer = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : null;
        $_SERVER['HTTP_REFERER'] = 'https://attacker.example.test/';

        try {
            $this->assertSame(
                'https://api.example.test:8443/path',
                $this->resolve('/path', null, [], 'https', 'api.example.test:8443')
            );
        } finally {
            if ($previousReferer === null) {
                unset($_SERVER['HTTP_REFERER']);
            } else {
                $_SERVER['HTTP_REFERER'] = $previousReferer;
            }
        }
    }

    public function testAllowsLocalhostOriginsOnlyForLocalRequestHosts()
    {
        $target = 'http://localhost:5174/course-reserves/faculty';
        $localOrigins = ['http://localhost:5174'];

        $this->assertSame($this->defaultRedirect, $this->resolve(
            $target,
            null,
            $localOrigins,
            'https',
            'api.example.test:8080'
        ));
        $this->assertSame($target, $this->resolve(
            $target,
            null,
            $localOrigins,
            'http',
            'localhost:8080'
        ));
    }

    public function testRejectsJavascriptAndDataUrls()
    {
        foreach (['javascript:alert(1)', 'data:text/html,phishing'] as $target) {
            $this->assertSame($this->defaultRedirect, $this->resolve($target));
        }
    }

    private function resolve(
        $target,
        $facultyFormUrl = null,
        array $corsOrigins = [],
        $requestScheme = 'https',
        $requestHost = 'api.example.test'
    ) {
        return SafeRedirect::resolve(
            $target,
            $facultyFormUrl,
            $corsOrigins,
            $requestScheme,
            $requestHost,
            $this->defaultRedirect
        );
    }
}
