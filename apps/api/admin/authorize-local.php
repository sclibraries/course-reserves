<?php
/**
 * authorize-local.php  — Local Docker development auth endpoint
 *
 * Bypasses Shibboleth entirely. Looks up DEV_USERNAME from the database,
 * generates a JWT access + refresh token pair, and redirects to the
 * frontend exactly as authorize-dev.php would for a real Shibboleth login.
 *
 * NEVER deploy this file to staging or production.
 *
 * Usage:  http://localhost:8080/course-reserves/backend/admin/authorize-local.php
 *   or    http://localhost:5173/course-reserves/backend/admin/authorize-local.php
 */

session_start();

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

defined('YII_DEBUG') or define('YII_DEBUG', true);
defined('YII_ENV')   or define('YII_ENV', 'dev');

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../vendor/yiisoft/yii2/Yii.php';

$config = require __DIR__ . '/../config/web.php';
$app    = new yii\web\Application($config);

// ── JWT secrets (must match web.php / controllers) ───────────────────────────
$secretKey        = getenv('JWT_SECRET_KEY');
$refreshSecretKey = getenv('JWT_REFRESH_SECRET_KEY');

// ── Dev user to impersonate ───────────────────────────────────────────────────
// Change DEV_USERNAME to any approved username in the users table,
// or leave as 'devadmin' (seeded by docker/mysql/init/02-seed-dev-user.sql).
$devUsername = getenv('DEV_USERNAME') ?: 'devadmin';

// CORS headers so the browser redirect works from any local origin
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

// ── Look up the user ──────────────────────────────────────────────────────────
try {
    $userInfo = Yii::$app->db->createCommand("
        SELECT id, username, full_name, email, role, department, institution, approved
        FROM   users
        WHERE  username = :u AND approved = 1
        LIMIT  1
    ")->bindValue(':u', $devUsername)->queryOne();
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    exit;
}

if (!$userInfo) {
    http_response_code(404);
    echo json_encode([
        'error'   => "Dev user '{$devUsername}' not found or not approved.",
        'hint'    => 'Run the DB seed or set DEV_USERNAME to an existing approved username.',
    ]);
    exit;
}

// ── Build JWT tokens ──────────────────────────────────────────────────────────
$issuedAt         = time();
$accessExpiration = $issuedAt + 3600;    // 1 hour
$refreshExpiration = $issuedAt + 86400;  // 24 hours

$accessPayload = [
    'iat'         => $issuedAt,
    'exp'         => $accessExpiration,
    'username'    => $userInfo['username'],
    'role'        => $userInfo['role'],
    'id'          => $userInfo['id'],
    'full_name'   => $userInfo['full_name'],
    'email'       => $userInfo['email'],
    'institution' => $userInfo['institution'],
];

$refreshPayload = [
    'iat'         => $issuedAt,
    'exp'         => $refreshExpiration,
    'username'    => $userInfo['username'],
    'role'        => $userInfo['role'],
    'id'          => $userInfo['id'],
    'full_name'   => $userInfo['full_name'],
    'email'       => $userInfo['email'],
    'institution' => $userInfo['institution'],
];

$accessToken  = JWT::encode($accessPayload, $secretKey, 'HS256');
$refreshToken = JWT::encode($refreshPayload, $refreshSecretKey, 'HS256');

// ── Set secure cookies ────────────────────────────────────────────────────────
// Detect HTTPS so the Secure flag is applied when running behind a TLS proxy
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
           (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
$secureFlag = $isHttps ? '; Secure' : '';
// Set access token cookie — not HttpOnly so JS can read it for Authorization header
header('Set-Cookie: accessToken=' . rawurlencode($accessToken) . '; Path=/' . $secureFlag . '; SameSite=Strict; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $accessExpiration), false);
// Set refresh token cookie — HttpOnly prevents XSS from stealing the long-lived token
header('Set-Cookie: refreshToken=' . rawurlencode($refreshToken) . '; Path=/' . $secureFlag . '; HttpOnly; SameSite=Strict; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $refreshExpiration), false);

// ── Redirect to frontend — tokens delivered via cookies, not URL ──────────────
$origin = isset($_GET['origin']) ? rtrim($_GET['origin'], '/') : 'http://localhost:5173';
header('Location: ' . $origin . '/course-reserves/admin');
exit;
