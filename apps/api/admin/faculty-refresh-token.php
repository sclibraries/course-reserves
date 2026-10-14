<?php
require_once __DIR__ . '/../config/environment.php';
// faculty-refresh-token.php - JWT-based refresh to match authorize.php pattern

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;
use app\services\FacultyTokenClaims;

// Include Yii and Composer
require_once dirname(__DIR__) . '/vendor/autoload.php';
require_once dirname(__DIR__) . '/vendor/yiisoft/yii2/Yii.php';
$config = require dirname(__DIR__) . '/config/web.php';
(new yii\web\Application($config));

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://libtools2.smith.edu');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Secrets loaded from environment variables
$accessSecretKey = getenv('JWT_SECRET_KEY');
$refreshSecretKey = getenv('JWT_REFRESH_SECRET_KEY');

try {
    // Accept refresh token from HttpOnly cookie (preferred) or JSON body (fallback)
    $refreshToken = $_COOKIE['refreshToken'] ?? null;
    if (!$refreshToken) {
        $input = json_decode(file_get_contents('php://input'), true);
        $refreshToken = $input['refreshToken'] ?? null;
    }
    if (!$refreshToken) {
        throw new Exception('Refresh token is required.');
    }

    // Decode provided refresh token
    $decoded = JWT::decode($refreshToken, new Key($refreshSecretKey, 'HS256'));

    // Extract claims; require username at minimum
    if (!isset($decoded->username)) {
        throw new Exception('Invalid token payload.');
    }

    $issuedAt = time();
    $accessExpiration = $issuedAt + 3600;   // 1 hour
    $refreshExpiration = $issuedAt + 86400; // 1 day
    $decodedClaims = (array) $decoded;

    $accessPayload = FacultyTokenClaims::forRefresh(
        $decodedClaims,
        $issuedAt,
        $accessExpiration
    );
    $newAccessToken = JWT::encode($accessPayload, $accessSecretKey, 'HS256');

    $refreshPayload = FacultyTokenClaims::forRefresh(
        $decodedClaims,
        $issuedAt,
        $refreshExpiration
    );
    $newRefreshToken = JWT::encode($refreshPayload, $refreshSecretKey, 'HS256');

    // Rotate refresh token cookie — HttpOnly prevents XSS access
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'libtools2.smith.edu';
    $isLocalhost = $host === 'localhost' || strpos($host, '127.0.0.1') === 0 || strpos($host, ':') !== false;
    $cookieDomain = $isLocalhost ? '' : 'libtools2.smith.edu';
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
    $domainAttr = $cookieDomain ? '; Domain=' . $cookieDomain : '';
    $secureAttr = ($scheme === 'https') ? '; Secure' : '';
    header('Set-Cookie: refreshToken=' . rawurlencode($newRefreshToken) . '; Path=/' . $domainAttr . $secureAttr . '; HttpOnly; SameSite=Strict; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $refreshExpiration), false);

    echo json_encode([
        'accessToken' => $newAccessToken,
        'refreshToken' => $newRefreshToken,
    ]);
} catch (Exception $e) {
    Yii::error('Faculty refresh token error: ' . $e->getMessage());
    http_response_code(401);
    echo json_encode(['error' => 'Invalid refresh token.']);
}
