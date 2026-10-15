<?php

namespace app\services;

use app\models\FacultyProxyActivityLog;
use app\models\FacultyProxyPermission;

/**
 * Builds the small, purpose-specific proxy API responses used by both UIs.
 */
class FacultyProxyPresenter
{
    public function grant(FacultyProxyPermission $permission, $includeFacultyId = false)
    {
        $courses = [];
        foreach ($permission->coursePermissions as $course) {
            $courses[] = [
                'folio_course_listing_id' => $course->folio_course_listing_id,
                'course_title' => $course->course_title,
                'term_id' => $course->term_id,
            ];
        }

        $grant = [
            'permission_id' => (int)$permission->permission_id,
            'faculty_display_name' => $permission->faculty_display_name,
            'proxy_display_name' => $permission->proxy_display_name,
            'proxy_email' => $permission->proxy_email,
            'permission_type' => $permission->permission_type,
            'scope_summary' => $this->scopeSummary($permission, count($courses)),
            'courses' => $courses,
            'status' => $permission->status,
            'invited_at' => $permission->invited_at,
            'invitation_expires_at' => $permission->invitation_expires_at,
            'accepted_at' => $permission->accepted_at,
            'expires_at' => $permission->expires_at,
            'revoked_at' => $permission->revoked_at,
        ];

        if ($includeFacultyId) {
            $grant['faculty_id'] = $permission->faculty_shibboleth_id;
        }

        return $grant;
    }

    public function invitation(FacultyProxyPermission $permission)
    {
        return [
            'faculty_name' => $permission->faculty_display_name,
            'scope_summary' => $this->scopeSummary($permission, $permission->getCoursePermissions()->count()),
            'invitation_expires_at' => $permission->invitation_expires_at,
        ];
    }

    public function activity(FacultyProxyActivityLog $entry)
    {
        $activity = $entry->toArray();
        $activity['details'] = $entry->getDetailsDecoded();
        return $activity;
    }

    private function scopeSummary(FacultyProxyPermission $permission, $courseCount)
    {
        if ($permission->permission_type === FacultyProxyPermission::PERMISSION_FULL_ACCESS) {
            return 'Edit all courses';
        }

        if ($permission->permission_type === FacultyProxyPermission::PERMISSION_VIEW_ONLY) {
            return 'View all courses';
        }

        return 'Edit selected courses (' . (int)$courseCount . ')';
    }
}
