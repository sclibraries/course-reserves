<?php
require_once __DIR__ . '/../config/environment.php';
// Mirror the structure of authorize.php for faculty, but without SQL lookups
session_start();
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;
use app\services\FacultyTokenClaims;

// Allow CORS dynamically for known origins; redirects aren't impacted by CORS,
// but token refresh/XHRs are during development.
$allowedOrigins = [
    'https://libtools2.smith.edu',
    'http://localhost',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
];
$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : null;
if ($requestOrigin && in_array($requestOrigin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
} else {
    header('Access-Control-Allow-Origin: https://libtools2.smith.edu');
}
header('Vary: Origin');
header('Access-Control-Allow-Credentials: true');

// Include Yii framework and the autoloader
require_once(__DIR__ . '/../vendor/autoload.php'); // Composer autoloader
require_once(__DIR__ . '/../vendor/yiisoft/yii2/Yii.php'); // Yii framework

// Load the configuration for the Yii application
$config = require(__DIR__ . '/../config/web.php');

// Create the Yii application instance (but do not run it)
$app = new yii\web\Application($config);

// Secrets (reuse the same pattern as authorize.php)
$secretKey = getenv('JWT_SECRET_KEY');
$refreshSecretKey = getenv('JWT_REFRESH_SECRET_KEY');

// Mapping school names to codes
$fcnames = array (
    "smith" => "SM",
    "amherst" => "AM",
    "umass" => "UM",
    "mtholyoke" => "MH",
    "hampshire" => "HA",
);

// Retrieve user information from Shibboleth (same attribute names as authorize.php)
$fcIdNumber = isset($_SERVER["fcIdNumber"]) ? $_SERVER["fcIdNumber"] : null;
$username    = isset($_SERVER["uid"]) ? $_SERVER["uid"] : (isset($_SERVER['REMOTE_USER']) ? $_SERVER['REMOTE_USER'] : null);
$firstname   = isset($_SERVER["givenName"]) ? $_SERVER["givenName"] : null;
$lastname    = isset($_SERVER["sn"]) ? $_SERVER["sn"] : null;
$aff         = isset($_SERVER["fcPersonAffiliation"]) ? $_SERVER["fcPersonAffiliation"] : null;
$email       = isset($_SERVER['mail']) ? $_SERVER['mail'] : null;

if ($fcIdNumber && $username && $firstname && $lastname && $aff) {
    // Extract institution from fcIdNumber
    $scope2 = explode("@", $fcIdNumber);
    $loc = $scope2[1] ?? '';
    $getlocation = explode('.', $loc);
    $location = strtolower($getlocation[0] ?? '');
    $locationCode = isset($fcnames[$location]) ? $fcnames[$location] : 'unknown';

    // Faculty/staff check (faculty endpoint allows faculty OR staff)
    $affLower = strtolower($aff);
    $hasAccess = (strpos($affLower, 'faculty') !== false) || (strpos($affLower, 'staff') !== false) || (strpos($affLower, 'employee') !== false);

    if ($hasAccess) {
        // Build JWTs directly from Shibboleth (no SQL lookup)
        $issuedAt = time();
        $accessExpiration = $issuedAt + 3600;    // 1 hour
        $refreshExpiration = $issuedAt + 86400;  // 1 day

        $fullName = trim(($firstname ?? '') . ' ' . ($lastname ?? ''));
        $role = (strpos($affLower, 'faculty') !== false) ? 'faculty' : 'staff';

        $identityClaims = [
            'username' => $username,
            'role' => $role,
            'id' => $username, // No DB id; use username as stable identifier
            'full_name' => $fullName,
            'email' => $email,
            'institution' => $locationCode,
        ];
        $accessPayload = FacultyTokenClaims::forAuthorization(
            $identityClaims,
            $fcIdNumber,
            $issuedAt,
            $accessExpiration
        );
        $accessToken = JWT::encode($accessPayload, $secretKey, 'HS256');

        $refreshPayload = FacultyTokenClaims::forAuthorization(
            $identityClaims,
            $fcIdNumber,
            $issuedAt,
            $refreshExpiration
        );
        $refreshToken = JWT::encode($refreshPayload, $refreshSecretKey, 'HS256');

        // Determine cookie parameters based on current host/scheme for dev/prod compatibility
        $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'libtools2.smith.edu';
        $isLocalhost = $host === 'localhost' || strpos($host, '127.0.0.1') === 0 || strpos($host, ':') !== false;
        // Use empty string for domain on localhost/ports to avoid invalid cookie domain
        $cookieDomain = $isLocalhost ? '' : 'libtools2.smith.edu';
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
        $cookieSecure = ($scheme === 'https');

        // Set access token cookie — not HttpOnly so JS can read it for Authorization header
        $domainAttr = $cookieDomain ? '; Domain=' . $cookieDomain : '';
        $secureAttr = $cookieSecure ? '; Secure' : '';
        header('Set-Cookie: accessToken=' . rawurlencode($accessToken) . '; Path=/' . $domainAttr . $secureAttr . '; SameSite=Strict; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $accessExpiration), false);
        // Set refresh token cookie — HttpOnly prevents XSS from stealing the long-lived token
        header('Set-Cookie: refreshToken=' . rawurlencode($refreshToken) . '; Path=/' . $domainAttr . $secureAttr . '; HttpOnly; SameSite=Strict; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $refreshExpiration), false);

        // Determine redirect target
        // Accept multiple param names commonly used by frontends: redirect, return, returnTo, next
        $redirectParam = null;
        foreach (['redirect', 'return', 'returnTo', 'next'] as $p) {
            if (isset($_GET[$p]) && $_GET[$p] !== '') {
                $redirectParam = $_GET[$p];
                break;
            }
        }
        $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'libtools2.smith.edu';
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
        $isLocalhost = $host === 'localhost' || strpos($host, '127.0.0.1') === 0 || strpos($host, ':') !== false;
        $defaultRedirect = $isLocalhost
            ? $scheme . '://' . $host . '/course-reserves/faculty'
            : 'https://libtools2.smith.edu/course-reserves/faculty';

        if ($redirectParam) {
            if (preg_match('#^https?://#i', $redirectParam)) {
                $redirectUrl = $redirectParam; // absolute URL
            } elseif (strpos($redirectParam, '/') === 0) {
                // If Referer is present, prefer its origin to preserve localhost:port during dev
                $referer = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : null;
                if ($referer && preg_match('#^(https?://[^/]+)#i', $referer, $m)) {
                    $origin = $m[1];
                    $redirectUrl = rtrim($origin, '/') . $redirectParam;
                } else {
                    $redirectUrl = $scheme . '://' . $host . $redirectParam; // fallback to current host
                }
            } else {
                $redirectUrl = $defaultRedirect;
            }
        } else {
            $redirectUrl = $defaultRedirect;
        }

        // Redirect to frontend — tokens delivered via cookies, not URL
        header('Location: ' . $redirectUrl);
        exit();
    } else {
        // Unauthorized for faculty endpoint
        print_r("User is not authorized to access this page.");
        exit();
    }
} else {
    // If Shibboleth session isn't properly set up, fail gracefully
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['error' => 'Invalid session or missing attributes.']);
}
