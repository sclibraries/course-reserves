<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;

/**
 * WorkflowCondition model
 *
 * @property int $id
 * @property int $step_id
 * @property string $condition_key
 * @property string $condition_label
 * @property string $condition_type (boolean|choice|value|calculation)
 * @property string $field_name
 * @property string $operator
 * @property string $expected_value
 * @property string $choices JSON
 * @property string $default_value
 * @property string $validation_rules JSON
 * @property string $metadata JSON
 * @property string $created_at
 * @property string $updated_at
 *
 * @property WorkflowStep $step
 * @property WorkflowStepTransition[] $transitions
 */
class WorkflowCondition extends ActiveRecord
{
    const TYPE_BOOLEAN = 'boolean';
    const TYPE_CHOICE = 'choice';
    const TYPE_VALUE = 'value';
    const TYPE_CALCULATION = 'calculation';

    public static function tableName()
    {
        return 'workflow_conditions';
    }

    public function rules()
    {
        return [
            [['step_id', 'condition_key', 'condition_label', 'condition_type'], 'required'],
            [['step_id'], 'integer'],
            [['condition_key', 'field_name'], 'string', 'max' => 100],
            [['condition_label', 'expected_value', 'default_value'], 'string', 'max' => 255],
            [['operator'], 'string', 'max' => 20],
            [['condition_type'], 'in', 'range' => [
                self::TYPE_BOOLEAN,
                self::TYPE_CHOICE,
                self::TYPE_VALUE,
                self::TYPE_CALCULATION
            ]],
            [['choices', 'validation_rules', 'metadata'], 'safe'],
        ];
    }

    public function attributeLabels()
    {
        return [
            'id' => 'ID',
            'step_id' => 'Step ID',
            'condition_key' => 'Condition Key',
            'condition_label' => 'Label',
            'condition_type' => 'Type',
            'field_name' => 'Field Name',
            'operator' => 'Operator',
            'expected_value' => 'Expected Value',
            'choices' => 'Choices',
            'default_value' => 'Default Value',
        ];
    }

    /**
     * Gets query for [[WorkflowStep]].
     */
    public function getStep()
    {
        return $this->hasOne(WorkflowStep::class, ['id' => 'step_id']);
    }

    /**
     * Gets query for [[WorkflowStepTransitions]].
     */
    public function getTransitions()
    {
        return $this->hasMany(WorkflowStepTransition::class, ['condition_id' => 'id']);
    }

    /**
     * Parse JSON fields after find
     */
    public function afterFind()
    {
        parent::afterFind();
        if ($this->choices && is_string($this->choices)) {
            $this->choices = json_decode($this->choices, true);
        }
        if ($this->validation_rules && is_string($this->validation_rules)) {
            $this->validation_rules = json_decode($this->validation_rules, true);
        }
        if ($this->metadata && is_string($this->metadata)) {
            $this->metadata = json_decode($this->metadata, true);
        }
    }

    /**
     * Encode JSON fields before save
     */
    public function beforeSave($insert)
    {
        if (parent::beforeSave($insert)) {
            if (is_array($this->choices)) {
                $this->choices = json_encode($this->choices);
            }
            if (is_array($this->validation_rules)) {
                $this->validation_rules = json_encode($this->validation_rules);
            }
            if (is_array($this->metadata)) {
                $this->metadata = json_encode($this->metadata);
            }
            return true;
        }
        return false;
    }

    /**
     * Evaluate condition against a value
     */
    public function evaluate($value, $context = [])
    {
        switch ($this->condition_type) {
            case self::TYPE_BOOLEAN:
                return (bool)$value;

            case self::TYPE_CHOICE:
                return $value;

            case self::TYPE_VALUE:
                return $this->evaluateOperator($value, $this->operator, $this->expected_value);

            case self::TYPE_CALCULATION:
                // Can be extended for complex calculations
                return $value;

            default:
                return $value;
        }
    }

    /**
     * Evaluate operator
     */
    protected function evaluateOperator($value, $operator, $expected)
    {
        switch ($operator) {
            case 'equals':
            case '==':
                return $value == $expected;

            case 'not_equals':
            case '!=':
                return $value != $expected;

            case 'greater_than':
            case '>':
                return $value > $expected;

            case 'less_than':
            case '<':
                return $value < $expected;

            case 'greater_or_equal':
            case '>=':
                return $value >= $expected;

            case 'less_or_equal':
            case '<=':
                return $value <= $expected;

            case 'contains':
                return strpos((string)$value, (string)$expected) !== false;

            case 'not_contains':
                return strpos((string)$value, (string)$expected) === false;

            case 'starts_with':
                return strpos((string)$value, (string)$expected) === 0;

            case 'ends_with':
                return substr((string)$value, -strlen($expected)) === $expected;

            case 'in':
                $array = is_array($expected) ? $expected : explode(',', $expected);
                return in_array($value, $array);

            case 'not_in':
                $array = is_array($expected) ? $expected : explode(',', $expected);
                return !in_array($value, $array);

            default:
                return false;
        }
    }
}
