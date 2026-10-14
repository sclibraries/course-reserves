<?php

namespace app\services;

use app\models\FacultySubmission;
use app\models\SubmissionCommunication;
use app\models\SubmissionCommunicationParticipant;
use app\models\SubmissionNewResource;
use app\models\User;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;

class SubmissionCommunicationService
{
    private $visibilityPolicy;

    public function __construct(?SubmissionCommunicationVisibilityPolicy $visibilityPolicy = null)
    {
        $this->visibilityPolicy = $visibilityPolicy ?: new SubmissionCommunicationVisibilityPolicy();
    }

    public function findFacultySubmission($uuid)
    {
        $submission = FacultySubmission::find()->where(['submission_uuid' => $uuid])->one();
        if (!$submission) throw new NotFoundHttpException('Submission not found');
        return $submission;
    }

    public function findStaffSubmission($id)
    {
        $submission = FacultySubmission::findOne($id);
        if (!$submission) throw new NotFoundHttpException('Submission not found');
        return $submission;
    }

    public function findMessage($id, $submissionId = null, $facultyVisible = false)
    {
        $query = SubmissionCommunication::find()->where(['id' => $id]);
        if ($submissionId !== null) $query->andWhere(['submission_id' => $submissionId]);
        if ($facultyVisible) $query->andWhere($this->visibilityPolicy->facultyCondition());
        $message = $query->one();
        if (!$message) throw new NotFoundHttpException('Message not found');
        return $message;
    }

    public function submissionMessages($submissionId, $facultyVisible = null)
    {
        if ($facultyVisible === null) $facultyVisible = !\app\components\Roles::isStaff(\Yii::$app->user->identity->role ?? null);
        $query = SubmissionCommunication::find()->where(['submission_id' => $submissionId]);
        if ($facultyVisible) $query->andWhere($this->visibilityPolicy->facultyCondition());
        return array_map(function ($message) { return $message->toArray(); }, $query->all());
    }

    public function threads($submissionId, $facultyVisible)
    {
        $query = SubmissionCommunication::find()->where([
            'submission_id' => $submissionId,
            'parent_message_id' => null,
        ]);
        if ($facultyVisible) $query->andWhere($this->visibilityPolicy->facultyCondition());
        $messages = $query->orderBy(['created_at' => SORT_DESC])->all();
        return array_map(function ($message) use ($facultyVisible) {
            return $this->formatCommunication($message, $facultyVisible);
        }, $messages);
    }

    public function create($submission, array $data, array $actor, $facultyMessage)
    {
        $message = $data['message'] ?? null;
        if (empty($message)) {
            throw new BadRequestHttpException('Message is required');
        }

        $parentId = $data['parent_message_id'] ?? null;
        $mentions = [];
        $parent = $this->findParent($submission->submission_id, $parentId);
        $this->validateResource($submission->submission_id, $data['resource_id'] ?? null);

        if ($facultyMessage) {
            $visibility = SubmissionCommunication::VISIBILITY_FACULTY;
            $this->visibilityPolicy->assertReplyMatchesParent($parent, $visibility);
        } else {
            $visibility = $this->visibilityPolicy->resolveStaffVisibility(
                $parent,
                $data['visibility'] ?? null
            );
        }

        $communication = new SubmissionCommunication();
        $communication->submission_id = $submission->submission_id;
        $communication->parent_message_id = $parent ? $parent->id : null;
        $communication->resource_id = $data['resource_id'] ?? null;
        $communication->communication_type = $facultyMessage
            ? SubmissionCommunication::TYPE_FACULTY_TO_STAFF
            : SubmissionCommunication::TYPE_STAFF_TO_STAFF;
        $communication->visibility = $visibility;
        $communication->message = $message;
        $communication->sender_type = $facultyMessage
            ? SubmissionCommunication::ACTOR_FACULTY
            : SubmissionCommunication::ACTOR_STAFF;
        $communication->sender_id = (string)$actor['id'];
        $communication->sender_name = $actor['name'];
        $communication->sender_email = $actor['email'] ?? null;

        if ($facultyMessage) {
            $communication->category = $data['category'] ?? 'question';
            $communication->subject = $data['subject'] ?? null;
            $communication->recipient_type = SubmissionCommunication::ACTOR_STAFF;
            $communication->priority = $data['priority'] ?? SubmissionCommunication::PRIORITY_NORMAL;
            $communication->status = SubmissionCommunication::STATUS_ACTIVE;
        } else {
            $communication->subject = $data['subject'] ?? null;
            $communication->category = $data['category'] ?? SubmissionCommunication::CATEGORY_NOTE;
            $communication->priority = $data['priority'] ?? SubmissionCommunication::PRIORITY_NORMAL;
            $communication->department = $data['department'] ?? SubmissionCommunication::DEPT_RESERVES;
            $mentions = $this->extractMentions($message);
            if ($mentions) {
                $communication->metadata = json_encode(['mentions' => $mentions]);
            }
            if (!empty($data['is_task'])) {
                $communication->is_task = 1;
                $communication->task_status = SubmissionCommunication::TASK_STATUS_PENDING;
                $communication->task_assignee = $data['task_assignee'] ?? null;
                $communication->task_due_date = $data['task_due_date'] ?? null;
            }
            if ($visibility === SubmissionCommunication::VISIBILITY_FACULTY) {
                $communication->recipient_type = SubmissionCommunication::ACTOR_FACULTY;
                $communication->recipient_id = $submission->shibboleth_user_id;
                $communication->recipient_name = $submission->faculty_display_name;
            }
        }

        $saved = $communication->save();
        if ($saved) {
            if (!$facultyMessage && !empty($mentions)) {
                $this->createMentionParticipants($communication->id, $mentions);
            }
            $activityData = $facultyMessage ? [
                'category' => $communication->category,
                'priority' => $communication->priority,
                'has_subject' => !empty($communication->subject),
                'is_reply' => !empty($parentId),
            ] : [];
            $communication->logActivity(
                (string)$actor['id'],
                $communication->sender_type,
                'created',
                $activityData
            );
        }

        return ['communication' => $communication, 'saved' => $saved];
    }

    public function update($communication, array $data, array $actor, $facultyMessage)
    {
        $oldMessage = $communication->message;
        if ($facultyMessage) {
            foreach (['message', 'subject', 'priority', 'status'] as $field) {
                if (array_key_exists($field, $data) && $data[$field] !== null) {
                    $communication->$field = $data[$field];
                }
            }
            if (($data['status'] ?? null) === SubmissionCommunication::STATUS_RESOLVED
                && !$communication->resolved_at) {
                $communication->resolved_at = date('Y-m-d H:i:s');
            }
        } elseif (isset($data['message'])) {
            $communication->message = $data['message'];
            $mentions = $this->extractMentions($data['message']);
            if ($mentions) {
                $metadata = $communication->getMetadataArray();
                $metadata['mentions'] = $mentions;
                $communication->metadata = json_encode($metadata);
                $this->createMentionParticipants($communication->id, $mentions);
            }
        }

        if (!$communication->save()) {
            return false;
        }
        $activityData = $facultyMessage ? [
            'changed_message' => $oldMessage !== $communication->message,
            'changed_priority' => isset($data['priority']),
            'changed_status' => isset($data['status']),
        ] : [];
        $communication->logActivity((string)$actor['id'], $facultyMessage ? SubmissionCommunication::ACTOR_FACULTY : SubmissionCommunication::ACTOR_STAFF, 'updated', $activityData);
        return true;
    }

    public function archiveFacultyMessage($communication, array $actor)
    {
        if (count($communication->replies) > 0) {
            return false;
        }
        $communication->logActivity($actor['id'], SubmissionCommunication::ACTOR_FACULTY, 'deleted', [
            'message_id' => $communication->id,
            'had_subject' => !empty($communication->subject),
            'category' => $communication->category,
        ]);
        $communication->status = SubmissionCommunication::STATUS_ARCHIVED;
        $communication->save(false);
        return true;
    }

    public function markAsRead($communication, $readerId, $readerType)
    {
        $communication->markAsRead((string)$readerId, $readerType);
    }

    private function findParent($submissionId, $parentMessageId)
    {
        if ($parentMessageId === null || $parentMessageId === '') return null;
        $parent = SubmissionCommunication::find()
            ->where(['id' => $parentMessageId, 'submission_id' => $submissionId])
            ->one();
        if (!$parent) throw new BadRequestHttpException('Parent message not found for this submission.');
        return $parent;
    }

    private function validateResource($submissionId, $resourceId)
    {
        if ($resourceId === null || $resourceId === '') return;
        $exists = SubmissionNewResource::find()
            ->where(['id' => $resourceId, 'submission_id' => $submissionId])
            ->exists();
        if (!$exists) throw new BadRequestHttpException('Resource not found for this submission.');
    }

    private function extractMentions($message)
    {
        return preg_match_all('/@(\w+)/', $message, $matches) ? array_unique($matches[1]) : [];
    }

    private function createMentionParticipants($communicationId, array $mentions)
    {
        foreach ($mentions as $username) {
            $user = User::findOne(['username' => $username]);
            if (!$user || SubmissionCommunicationParticipant::findOne([
                'communication_id' => $communicationId,
                'participant_id' => $user->id,
            ])) {
                continue;
            }
            $participant = new SubmissionCommunicationParticipant();
            $participant->communication_id = $communicationId;
            $participant->participant_type = 'staff';
            $participant->participant_id = (string)$user->id;
            $participant->participant_name = $user->full_name ?? $user->username;
            $participant->participant_email = $user->email;
            $participant->role = SubmissionCommunicationParticipant::ROLE_RECIPIENT;
            $participant->save();
        }
    }

    public function formatCommunication($communication, $facultyVisible)
    {
        if ($facultyVisible) {
            $replies = $communication->getReplies()
                ->andWhere($this->visibilityPolicy->facultyCondition())
                ->all();
            $formattedReplies = [];
            foreach ($replies as $reply) {
                $formattedReplies[] = [
                    'id' => $reply->id,
                    'message' => $reply->message,
                    'sender_name' => $reply->sender_name,
                    'sender_type' => $reply->sender_type,
                    'created_at' => $reply->created_at,
                ];
            }
            return [
                'id' => $communication->id,
                'resource_id' => $communication->resource_id,
                'subject' => $communication->subject,
                'message' => $communication->message,
                'category' => $communication->category,
                'priority' => $communication->priority,
                'status' => $communication->status,
                'sender_name' => $communication->sender_name,
                'sender_type' => $communication->sender_type,
                'created_at' => $communication->created_at,
                'is_read' => (bool)$communication->is_read,
                'reply_count' => count($formattedReplies),
                'replies' => $formattedReplies,
            ];
        }

        $fields = 'id,submission_id,parent_message_id,resource_id,communication_type,visibility,category,subject,message,sender_type,sender_id,sender_name,sender_email,priority,status,is_read,is_flagged,is_task,task_status,task_assignee,task_due_date,created_at,updated_at';
        $data = $communication->toArray(explode(',', $fields), [], false);
        $data['metadata'] = $communication->getMetadataArray();
        $data['replies'] = [];
        foreach ($communication->getReplies()->all() as $reply) {
            $data['replies'][] = $this->formatCommunication($reply, false);
        }
        return $data;
    }
}
