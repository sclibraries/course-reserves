<?php
require_once __DIR__ . '/../config/environment.php';

session_start();
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

// Allow CORS for localhost:5173 during testing (for non-redirect API calls, if needed)
header('Access-Control-Allow-Origin: https://localhost:5173');
header('Access-Control-Allow-Credentials: true');

// Include Yii framework and the autoloader
require_once(__DIR__ . '/../vendor/autoload.php'); // Composer autoloader
require_once(__DIR__ . '/../vendor/yiisoft/yii2/Yii.php'); // Yii framework
use app\services\ApprovedUserLookup;

// Load the configuration for the Yii application
$config = require(__DIR__ . '/../config/web.php');

// Create the Yii application instance (but do not run it)
$app = new yii\web\Application($config);

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

// Retrieve user information from Shibboleth
$fcIdNumber = isset($_SERVER["fcIdNumber"]) ? $_SERVER["fcIdNumber"] : null;
$username    = isset($_SERVER["uid"]) ? $_SERVER["uid"] : null;
$firstname   = isset($_SERVER["givenName"]) ? $_SERVER["givenName"] : null;
$lastname    = isset($_SERVER["sn"]) ? $_SERVER["sn"] : null;
$aff         = isset($_SERVER["fcPersonAffiliation"]) ? $_SERVER["fcPersonAffiliation"] : null;

if ($fcIdNumber && $username && $firstname && $lastname && $aff) {
    // Extract relevant information from Shibboleth attributes
    $scope = explode(".", $fcIdNumber);
    $scope2 = explode("@", $fcIdNumber);
    $FCID = $scope[0];
    $shib_id = $scope2[0];
    
    $loc = $scope2[1];
    $getlocation = explode('.', $loc);
    $location = strtolower($getlocation[0]);
    $locationCode = isset($fcnames[$location]) ? $fcnames[$location] : 'unknown';

    // Check if the user is a staff member
    if (strpos($aff, 'staff') !== false || strpos($aff, 'employee') !== false || strpos($aff, 'Employee') !== false) {
        // Check if the user exists in the database
        $userInfo = (new ApprovedUserLookup())->find($username);
        
        if ($userInfo && $userInfo['approved'] == 1) {
            // Generate JWT tokens with user information
            $issuedAt = time();
            $accessExpiration = $issuedAt + 3600;   // Access token: 1 hour
            $refreshExpiration = $issuedAt + 86400;   // Refresh token: 1 day

            // Access token payload and encoding
            $accessPayload = [
                'iat' => $issuedAt,
                'exp' => $accessExpiration,
                'username' => $username,
                'role' => $userInfo['role'],            // Include user role
                'id' => $userInfo['id'],                // Include user ID
                'full_name' => $userInfo['full_name'],  // Include user's full name
                'email' => $userInfo['email'],          // Include user's email
                'institution' => $userInfo['institution'] 
            ];
            $accessToken = JWT::encode($accessPayload, $secretKey, 'HS256');

            // Refresh token payload and encoding
            $refreshPayload = [
                'iat' => $issuedAt,
                'exp' => $refreshExpiration,
                'username' => $username,
                'role' => $userInfo['role'],            // Include user role
                'id' => $userInfo['id'],                // Include user ID
                'full_name' => $userInfo['full_name'],  // Include user's full name
                'email' => $userInfo['email'],          // Include user's email
                'institution' => $userInfo['institution'] // Include user's institution
            ];
            $refreshToken = JWT::encode($refreshPayload, $refreshSecretKey, 'HS256');

            // Set access token cookie — not HttpOnly so JS can read it for Authorization header
            header('Set-Cookie: accessToken=' . rawurlencode($accessToken) . '; Path=/; Secure; SameSite=Strict; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $accessExpiration), false);
            // Set refresh token cookie — HttpOnly prevents XSS from stealing the long-lived token
            header('Set-Cookie: refreshToken=' . rawurlencode($refreshToken) . '; Path=/; Secure; HttpOnly; SameSite=Strict; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', $refreshExpiration), false);

            // Redirect to admin — tokens delivered via secure cookies, not URL
            header('Location: http://localhost:5173/course-reserves/admin');
            exit();
        } else {
            header('Location: http://localhost:5173/course-reserves/register?username=' . urlencode($username));
            exit();
        }
    } else {
        // Unauthorized; display an error message or redirect to home
        print_r("User is not authorized to access this page.");
        exit();
    }
} else {
    // If Shibboleth session isn't properly set up, fail gracefully
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['error' => 'Invalid session or missing attributes.']);
}

