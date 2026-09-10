<?php

namespace app\models;

/**
 * This is the ActiveQuery class for [[Courses]].
 *
 * @see Courses
 */
class CoursesQuery extends \yii\db\ActiveQuery
{
    /**
     * Filters courses by department name.
     *
     * @param string $departmentName
     * @return CoursesQuery
     */
    public function byDepartment($departmentName)
    {
        return $this->andWhere(['department_name' => $departmentName]);
    }

    /**
     * Filters courses by term name.
     *
     * @param string $termName
     * @return CoursesQuery
     */
    public function byTerm($termName)
    {
        return $this->andWhere(['term_name' => $termName]);
    }

    /**
     * Filters courses by location name.
     *
     * @param string $locationName
     * @return CoursesQuery
     */
    public function byLocation($locationName)
    {
        return $this->andWhere(['location_name' => $locationName]);
    }

    /**
     * Searches courses by name or number.
     *
     * @param string $keyword
     * @return CoursesQuery
     */
    public function search($keyword)
    {
        return $this->andWhere([
            'or',
            ['like', 'course_name', $keyword],
            ['like', 'course_number', $keyword],
        ]);
    }

    /**
     * Filters courses that have linked resources.
     *
     * @return CoursesQuery
     */
    public function hasResources()
    {
        return $this->joinWith('courseResources')->distinct();
    }

    /**
     * Filters courses that have linked instructors.
     *
     * @return CoursesQuery
     */
    public function hasInstructors()
    {
        return $this->joinWith('courseInstructors')->distinct();
    }

    /**
     * {@inheritdoc}
     * @return Courses[]|array
     */
    public function all($db = null)
    {
        return parent::all($db);
    }

    /**
     * {@inheritdoc}
     * @return Courses|array|null
     */
    public function one($db = null)
    {
        return parent::one($db);
    }
}