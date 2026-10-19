<?php

namespace app\services;

use app\models\CourseOfferings;
use app\models\CourseResources;
use app\models\Courses;
use app\models\Folder;
use app\models\MaterialTypes;
use app\models\ResourceLinks;
use app\models\ResourceMetadata;
use app\models\Resources;

/** Creates and removes the synthetic course materials used by the Reuse demo. */
class DevSeedPreviousCourseService
{
    const COURSE_UUID = '00000000-0000-4000-8000-000000000229';
    const LISTING_ID = '00000000-0000-4000-8000-000000000209';
    const FOLDER_DESCRIPTION = 'test-cx029-previous-course-week-1';
    const RESOURCE_PREFIX = 'test-cx029-';
    const PHYSICAL_COUNT = 3;

    public function seed()
    {
        $course = $this->findOrCreateCourse();
        $offering = $this->findOrCreateOffering($course);
        $folder = $this->findOrCreateFolder();
        $definitions = $this->resourceDefinitions();

        foreach ($definitions as $definition) {
            $this->saveResource($offering, $folder, $definition);
        }

        return [
            'courseNumber' => 'TST 101',
            'termName' => 'Spring 2026',
            'electronicCount' => count($definitions),
            'physicalCount' => self::PHYSICAL_COUNT,
        ];
    }

    public function reset()
    {
        $resources = Resources::find()
            ->where(['like', 'name', self::RESOURCE_PREFIX])
            ->all();
        $resourceIds = [];
        foreach ($resources as $resource) {
            $resourceIds[] = (int)$resource->resource_id;
        }

        if ($resourceIds) {
            ResourceMetadata::deleteAll(['resource_id' => $resourceIds]);
            ResourceLinks::deleteAll(['resource_id' => $resourceIds]);
            CourseResources::deleteAll(['resource_id' => $resourceIds]);
            Resources::deleteAll(['resource_id' => $resourceIds]);
        }

        $folder = Folder::findOne(['description' => self::FOLDER_DESCRIPTION]);
        if ($folder) {
            $folder->delete();
        }

        $offering = CourseOfferings::findOne(['folio_course_id' => self::LISTING_ID]);
        if ($offering) {
            $offering->delete();
        }

        $course = Courses::findOne(['permanent_course_uuid' => self::COURSE_UUID]);
        if ($course && !CourseOfferings::find()->where(['course_id' => $course->course_id])->exists()) {
            $course->delete();
        }
    }

    private function findOrCreateCourse()
    {
        $course = Courses::findOne(['permanent_course_uuid' => self::COURSE_UUID]);
        if (!$course) {
            $course = new Courses();
            $course->permanent_course_uuid = self::COURSE_UUID;
        }

        $course->course_name = 'TST 101 Test Biology';
        $course->course_number = 'TST 101';
        $course->department_id = '00000000-0000-4000-8000-000000000501';
        $course->department_name = 'SC Test Department';
        $course->location_id = '00000000-0000-4000-8000-000000000601';
        $course->location_name = 'Neilson Library';

        if (!$course->save()) {
            throw new \RuntimeException('Could not seed the synthetic previous course.');
        }

        return $course;
    }

    private function findOrCreateOffering(Courses $course)
    {
        $offering = CourseOfferings::findOne(['folio_course_id' => self::LISTING_ID]);
        if ($offering && (int)$offering->course_id !== (int)$course->course_id) {
            throw new \RuntimeException('The CX-029 FOLIO listing is linked to another course.');
        }
        if (!$offering) {
            $offering = new CourseOfferings();
        }

        $offering->course_id = $course->course_id;
        $offering->folio_course_id = self::LISTING_ID;
        $offering->term_id = '00000000-0000-4000-8000-000000000003';
        $offering->term_name = 'Spring 2026';
        $offering->section_name = '01';
        $offering->start_date = '2026-01-01 00:00:00';
        $offering->end_date = '2026-05-31 23:59:59';
        $offering->status = 'inactive';

        if (!$offering->save()) {
            throw new \RuntimeException('Could not seed the synthetic previous course offering.');
        }

        return $offering;
    }

    private function findOrCreateFolder()
    {
        $folder = Folder::findOne(['description' => self::FOLDER_DESCRIPTION]);
        if (!$folder) {
            $folder = new Folder();
        }
        $folder->name = 'Week 1';
        $folder->description = self::FOLDER_DESCRIPTION;

        if (!$folder->save()) {
            throw new \RuntimeException('Could not seed the synthetic previous course folder.');
        }

        return $folder;
    }

    private function saveResource(CourseOfferings $offering, Folder $folder, array $definition)
    {
        $materialType = MaterialTypes::findOne(['name' => $definition['type']]);
        if (!$materialType) {
            $materialType = new MaterialTypes();
            $materialType->name = $definition['type'];
            if (!$materialType->save()) {
                throw new \RuntimeException('Could not seed material type ' . $definition['type'] . '.');
            }
        }

        $resource = Resources::findOne(['name' => $definition['name']]);
        if (!$resource) {
            $resource = new Resources();
        }
        $resource->name = $definition['name'];
        $resource->item_url = $definition['url'];
        $resource->description = $definition['description'];
        $resource->material_type_id = $materialType->material_type_id;
        $resource->use_proxy = 0;

        if (!$resource->save()) {
            throw new \RuntimeException('Could not seed electronic resource ' . $definition['name'] . '.');
        }

        $link = CourseResources::findOne([
            'offering_id' => $offering->offering_id,
            'resource_id' => $resource->resource_id,
        ]);
        if (!$link) {
            $link = new CourseResources();
            $link->offering_id = $offering->offering_id;
            $link->resource_id = $resource->resource_id;
        }
        $link->order = $definition['order'];
        $link->folder_id = $definition['inFolder'] ? $folder->folder_id : null;

        if (!$link->save()) {
            throw new \RuntimeException('Could not link electronic resource ' . $definition['name'] . '.');
        }
    }

    private function resourceDefinitions()
    {
        return [
            [
                'name' => 'test-cx029-article',
                'url' => 'https://example.test/cx029/journal-article',
                'description' => 'Synthetic journal article for the previous-course reuse demo.',
                'type' => 'article',
                'order' => 1,
                'inFolder' => true,
            ],
            [
                'name' => 'test-cx029-chapter',
                'url' => 'https://example.test/cx029/chapter',
                'description' => 'Synthetic book chapter for the previous-course reuse demo.',
                'type' => 'chapter',
                'order' => 2,
                'inFolder' => true,
            ],
            [
                'name' => 'test-cx029-website',
                'url' => 'https://example.test/cx029/website',
                'description' => 'Synthetic website for the previous-course reuse demo.',
                'type' => 'website',
                'order' => 3,
                'inFolder' => false,
            ],
            [
                'name' => 'test-cx029-video',
                'url' => 'https://example.test/cx029/video',
                'description' => 'Synthetic video for the previous-course reuse demo.',
                'type' => 'video',
                'order' => 4,
                'inFolder' => false,
            ],
        ];
    }
}
