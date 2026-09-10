<?php

namespace app\services;

use app\models\FacultySubmission;
use app\models\Folder;
use app\models\SubmissionFolder;
use yii\web\BadRequestHttpException;
use yii\web\ServerErrorHttpException;

class SubmissionCourseScaffoldService
{
    public function ensureSubmissionCourseScaffold(FacultySubmission $submission)
    {
        if (empty($submission->offering_id) || empty($submission->folio_course_listing_id)) {
            throw new BadRequestHttpException('Submission must be linked to a course offering before scaffolding folders.');
        }

        $folders = SubmissionFolder::find()
            ->where(['submission_id' => $submission->submission_id])
            ->orderBy(['display_order' => SORT_ASC, 'folder_id' => SORT_ASC])
            ->all();

        $mappedFolders = [];
        foreach ($folders as $submissionFolder) {
            $courseFolder = $this->findOrCreateCourseFolder($submissionFolder->folder_name);
            if (!$courseFolder) {
                continue;
            }

            if ((int)$submissionFolder->course_folder_id !== (int)$courseFolder->folder_id) {
                $submissionFolder->course_folder_id = $courseFolder->folder_id;
                if (!$submissionFolder->save()) {
                    throw new ServerErrorHttpException('Failed to map submission folder: ' . json_encode($submissionFolder->getErrors()));
                }
            }

            $mappedFolders[] = [
                'submission_folder_id' => $submissionFolder->folder_id,
                'folder_name' => $submissionFolder->folder_name,
                'display_order' => (int)$submissionFolder->display_order,
                'course_folder_id' => (int)$courseFolder->folder_id,
            ];
        }

        return $mappedFolders;
    }

    public function findOrCreateCourseFolder($folderName)
    {
        $folderName = trim((string)$folderName);
        if ($folderName === '') {
            return null;
        }

        $folder = Folder::findOne(['name' => $folderName]);
        if ($folder) {
            return $folder;
        }

        $folder = new Folder();
        $folder->name = $folderName;

        if (!$folder->save()) {
            throw new ServerErrorHttpException('Failed to create course folder: ' . json_encode($folder->getErrors()));
        }

        return $folder;
    }
}
