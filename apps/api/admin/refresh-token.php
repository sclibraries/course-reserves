<?php
require_once __DIR__ . '/../config/environment.php';
// refresh-token.php

// Start session if your application logic requires it
session_start();

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

// Set headers for JSON response and CORS (adjust the origin for production)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://libtools2.smith.edu');
header('Access-Control-Allow-Credentials: true');

// Include Yii framework and Composer autoloader
require_once(__DIR__ . '/../vendor/autoload.php');
require_once(__DIR__ . '/../vendor/yiisoft/yii2/Yii.php');
$config = require(__DIR__ . '/../config/web.php');
$app = new yii\web\Application($config);

// Secret keys loaded from environment variables
$accessSecretKey = getenv('JWT_SECRET_KEY');
$refreshSecretKey = getenv('JWT_REFRESH_SECRET_KEY');

// Accept refresh token from HttpOnly cookie (preferred) or JSON body (fallback)
$refreshToken = $_COOKIE['refreshToken'] ?? null;
if (!$refreshToken) {
    $input = json_decode(file_get_contents('php://input'), true);
    $refreshToken = $input['refreshToken'] ?? null;
}
if (!$refreshToken) {
    http_response_code(400);
    echo json_encode(['error' => 'Refresh token is required.']);
    exit();
}

try {
    // Decode the refresh token using the refresh secret key
    $decoded = JWT::decode($refreshToken, new Key($refreshSecretKey, 'HS256'));

    // Verify the necessary claims exist, for example, username
    if (!isset($decoded->username)) {
        throw new Exception('Invalid token payload.');
    }
    $username = $decoded->username;

    // Optionally, verify that this refresh token is valid for this user
    // e.g., check in the database or compare token identifiers

    // Generate new tokens
    $issuedAt = time();
    $accessExpiration = $issuedAt + 3600;   // Access token valid for 1 hour
    $refreshExpiration = $issuedAt + 86400;   // Refresh token valid for 1 day

    // Create the access token payload
    $accessPayload = [
       'iat'      => $issuedAt,
       'exp'      => $accessExpiration,
       'username' => $username,
    ];
    $newAccessToken = JWT::encode($accessPayload, $accessSecretKey, 'HS256');

    // Create the refresh token payload
    $refreshPayload = [
       'iat'      => $issuedAt,
       'exp'      => $refreshExpiration,
       'username' => $username,
    ];
    $newRefreshToken = JWT::encode($refreshPayload, $refreshSecretKey, 'HS256');

    // Rotate refresh token cookie — HttpOnly prevents XSS access
    header('Set-Cookie: refreshToken=' . rawurlencode($newRefreshToken) . '; Path=/; Secure; HttpOnly; SameSite=Strict; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $refreshExpiration), false);
    // Return the new access token in the response body
    echo json_encode([
        'accessToken'  => $newAccessToken,
        'refreshToken' => $newRefreshToken,
    ]);
} catch (Exception $e) {
    // Log the error securely if needed, then return an error response.
    http_response_code(401);
    echo json_encode(['error' => 'Invalid refresh token.']);
}
