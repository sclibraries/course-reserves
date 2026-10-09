<?php

namespace app\controllers;

use Yii;
use app\models\Tracking;
use yii\web\Controller;
use yii\web\BadRequestHttpException;

class TrackingController extends Controller
{
    public $modelClass = 'app\models\Tracking';

    /**
     * Get detailed analytics for a specific course
     */
    public function actionCourseDetail()
    {
        $courseName = \Yii::$app->request->get('course-name');
        $college = \Yii::$app->request->get('college');
        
        if (!$courseName) {
            throw new BadRequestHttpException('Course name is required');
        }
        
        // Start with a base query for this specific course
        $query = $this->modelClass::find()
            ->andWhere(['course_name' => $courseName]);
            
        // Add college filter if provided
        if ($college) {
            $query->andWhere(['college' => $college]);
        }
        
        // Apply any additional filters (date range, etc.)
        $this->applyFilters($query);
        
        // Get total events for this course
        $totalEvents = (clone $query)->count();
        
        // Get unique users count
        $uniqueUsers = (clone $query)
            ->select(['user_id'])
            ->distinct()
            ->count();
        
        // Get event types distribution for this course
        $eventTypes = (clone $query)
            ->select(['event_type', 'COUNT(*) as count'])
            ->groupBy(['event_type'])
            ->orderBy(['count' => SORT_DESC])
            ->asArray()
            ->all();
        
        // Get data by terms for this course
        $termData = (clone $query)
            ->select([
                'term',
                'COUNT(*) as count',
                'COUNT(DISTINCT user_id) as uniqueUsers',
                'COUNT(DISTINCT event_type) as eventTypes'
            ])
            ->andWhere(['IS NOT', 'term', null])
            ->andWhere(['<>', 'term', 'N/A'])
            ->groupBy(['term'])
            ->orderBy(['term' => SORT_DESC])
            ->asArray()
            ->all();
        
        // Get recent events for this course (limited to last 100 for performance)
        $events = (clone $query)
            ->orderBy(['created_at' => SORT_DESC])
            ->limit(100)
            ->asArray()
            ->all();
        
        // Count terms where this course was active
        $termsActive = (clone $query)
            ->select(['term'])
            ->andWhere(['IS NOT', 'term', null])
            ->andWhere(['<>', 'term', 'N/A'])
            ->distinct()
            ->count();
        
        return [
            'courseName' => $courseName,
            'college' => $college,
            'totalEvents' => $totalEvents,
            'uniqueUsers' => $uniqueUsers,
            'termsActive' => $termsActive,
            'eventTypes' => $eventTypes,
            'termData' => $termData,
            'events' => $events
        ];
    }

    // ...existing code...
}