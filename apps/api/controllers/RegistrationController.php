<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\filters\Cors;
use yii\web\Response;
use app\models\User;
use yii\web\BadRequestHttpException;

class RegistrationController extends Controller
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();
        
        // Ensure all responses are in JSON format
        $behaviors['contentNegotiator'] = [
            'class' => 'yii\filters\ContentNegotiator',
            'formats' => [
                'application/json' => Response::FORMAT_JSON,
            ],
        ];

        // CORS settings
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                // Make sure your frontend domain is listed here
                'Origin' => \app\components\CorsOriginPolicy::allowedOrigins(),
                'Access-Control-Request-Method' => ['GET', 'POST', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['*'], // Allow all headers
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Max-Age' => 3600,
                'Access-Control-Allow-Headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
                'Access-Control-Expose-Headers' => ['*'],
            ],
        ];

        return \app\components\CorsOriginPolicy::corsFirst($behaviors);
    }
    
    public function actionOptions() 
    {
        if (Yii::$app->request->method === 'OPTIONS') {
            Yii::$app->response->headers->set('Allow', 'POST, OPTIONS');
        }
        return [];
    }

    /**
     * Handles user registration requests
     */
    public function actionRegister()
    {
        $user = new User();
        $user->load(Yii::$app->request->getBodyParams(), '');
        $this->applyRegistrationDefaults($user);
        
        // Validate email domain
        $validDomains = ['smith.edu', 'hampshire.edu', 'amherst.edu', 'mtholyoke.edu', 'umass.edu'];
        $emailParts = explode('@', $user->email);
        if (count($emailParts) !== 2 || !in_array($emailParts[1], $validDomains)) {
            throw new BadRequestHttpException('Email must be from a Five College institution.');
        }
        
        // Validate and save
        if ($user->validate()) {
            if ($user->save()) {
                // Send notification email to administrators
                $this->sendAdminNotification($user);
                
                return [
                    'success' => true,
                    'message' => 'Registration successful. Your account is pending approval.'
                ];
            }
        }
        
        // Return validation errors if any
        return [
            'success' => false,
            'message' => 'Registration failed',
            'errors' => $user->errors
        ];
    }

    private function applyRegistrationDefaults($user): void
    {
        $user->role = 'user';
        $user->approved = 0;
        $user->created_at = date('Y-m-d H:i:s');
    }
    
    /**
     * Sends an email notification to administrators about the new registration
     */
    private function sendAdminNotification($user)
    {
        // Get admin emails from configuration or database
        $adminEmails = Yii::$app->params['adminEmails'] ?? ['admin@smith.edu'];
        
        $subject = 'New Course Reserves User Registration';
        
        $body = "A new user has registered for Course Reserves and requires approval:\n\n" .
                "Username: {$user->username}\n" .
                "Full Name: {$user->full_name}\n" .
                "Email: {$user->email}\n" .
                "Department: {$user->department}\n" .
                "Institution: {$user->institution}\n" .
                "Requested on: {$user->created_at}\n\n" .
                "To approve this user, please log in to the admin panel.";
        
        foreach ($adminEmails as $email) {
            Yii::$app->mailer->compose()
                ->setTo($email)
                ->setFrom(['coursereserves@smith.edu' => 'Course Reserves System'])
                ->setSubject($subject)
                ->setTextBody($body)
                ->send();
        }
    }
}
