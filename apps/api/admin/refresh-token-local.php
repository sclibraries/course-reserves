<?php
require_once __DIR__ . '/../config/environment.php';
if (!\app\components\Environment::isDev()) {
    http_response_code(404);
    exit;
}

/**
 * refresh-token-local.php — Local Docker development token refresh endpoint
 *
 * Validates an existing refresh token and issues a new access token.
 * Mirrors the behaviour of refresh-token-dev.php without requiring Shibboleth.
 *
 * NEVER deploy this file to staging or production.
 */

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../vendor/yiisoft/yii2/Yii.php';

$config = require __DIR__ . '/../config/web.php';
$app    = new yii\web\Application($config);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$secretKey        = getenv('JWT_SECRET_KEY');
$refreshSecretKey = getenv('JWT_REFRESH_SECRET_KEY');

// Accept refresh token from cookie or JSON body
$refreshToken = $_COOKIE['refreshToken'] ?? null;

if (!$refreshToken) {
    $body = json_decode(file_get_contents('php://input'), true);
    $refreshToken = $body['refreshToken'] ?? null;
}

if (!$refreshToken) {
    http_response_code(401);
    echo json_encode(['error' => 'No refresh token provided']);
    exit;
}

try {
    $decoded = JWT::decode($refreshToken, new Key($refreshSecretKey, 'HS256'));
} catch (\Exception $e) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid or expired refresh token: ' . $e->getMessage()]);
    exit;
}

// Issue a fresh access token using the claims from the refresh token
$issuedAt         = time();
$accessExpiration = $issuedAt + 3600;

$accessPayload = [
    'iat'         => $issuedAt,
    'exp'         => $accessExpiration,
    'username'    => $decoded->username,
    'role'        => $decoded->role,
    'id'          => $decoded->id,
    'full_name'   => $decoded->full_name,
    'email'       => $decoded->email,
    'institution' => $decoded->institution,
];

$newAccessToken = JWT::encode($accessPayload, $secretKey, 'HS256');

echo json_encode([
    'status'      => 'success',
    'accessToken' => $newAccessToken,
]);
