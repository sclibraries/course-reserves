<?php

namespace app\services;

/** Builds faculty-facing correction text from the changed course fields only. */
class SubmissionCorrectionMessageBuilder
{
    public function build(array $before, array $after)
    {
        $changes = [];
        foreach (['course_code' => 'course number', 'section' => 'section'] as $field => $label) {
            if (!array_key_exists($field, $before) || !array_key_exists($field, $after)) {
                continue;
            }
            if ((string)$before[$field] === (string)$after[$field]) {
                continue;
            }
            $changes[] = $label . ' ' . $this->displayValue($before[$field]) . ' -> '
                . $this->displayValue($after[$field]);
        }

        $message = 'We updated your course details to match the library system';
        return $message . ($changes ? ': ' . implode('; ', $changes) : '') . '.';
    }

    private function displayValue($value)
    {
        $value = trim((string)$value);
        return $value === '' ? 'blank' : $value;
    }
}
