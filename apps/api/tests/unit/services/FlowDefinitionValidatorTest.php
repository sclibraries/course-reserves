<?php

namespace tests\unit\services;

use app\services\FlowDefinitionValidator;

class FlowDefinitionValidatorTest extends \Codeception\Test\Unit
{
    public function testRejectsDuplicateStepAndOutcomeKeys()
    {
        $steps = $this->validSteps();
        $steps[1]['key'] = 'start';
        $steps[0]['outcomes'][] = [
            'key' => 'yes',
            'label' => 'Duplicate outcome',
            'next' => ['step' => 'finish'],
        ];

        $errors = (new FlowDefinitionValidator())->validate($steps, []);

        $this->assertErrorContains($errors, 'duplicate step key');
        $this->assertErrorContains($errors, 'duplicate outcome key');
    }

    public function testRejectsDanglingStepTargetsAndUnknownGroups()
    {
        $steps = $this->validSteps();
        $steps[0]['outcomes'][0]['next'] = ['step' => 'missing'];
        $steps[0]['outcomes'][1]['next'] = ['handoff_group' => 'Missing group'];

        $errors = (new FlowDefinitionValidator())->validate($steps, ['Acquisitions']);

        $this->assertErrorContains($errors, 'unknown step');
        $this->assertErrorContains($errors, 'unknown group');
    }

    public function testRequiresAReachableFinishStep()
    {
        $steps = [
            [
                'key' => 'start',
                'kind' => 'action',
                'label' => 'Start',
                'help_text' => null,
                'outcomes' => [['key' => 'done', 'label' => 'Done', 'next' => ['step' => 'start']]],
            ],
            [
                'key' => 'orphan',
                'kind' => 'action',
                'label' => 'Orphan',
                'help_text' => null,
                'outcomes' => [['key' => 'done', 'label' => 'Done', 'next' => ['step' => 'orphan']]],
            ],
        ];

        $errors = (new FlowDefinitionValidator())->validate($steps, []);

        $this->assertErrorContains($errors, 'finish step');
        $this->assertErrorContains($errors, 'unreachable');
    }

    public function testAllowsEbookPreparationFinishStates()
    {
        foreach (['prepared', 'needs_access_path', 'unavailable'] as $state) {
            $steps = $this->validSteps();
            $steps[1]['finish_state'] = $state;

            $this->assertSame([], (new FlowDefinitionValidator())->validate($steps, ['Acquisitions']));
        }
    }

    private function validSteps()
    {
        return [
            [
                'key' => 'start',
                'kind' => 'question',
                'label' => 'Start?',
                'help_text' => null,
                'outcomes' => [
                    ['key' => 'yes', 'label' => 'Yes', 'next' => ['step' => 'finish']],
                    ['key' => 'no', 'label' => 'No', 'next' => ['handoff_group' => 'Acquisitions']],
                ],
            ],
            [
                'key' => 'finish',
                'kind' => 'finish',
                'label' => 'Finished',
                'help_text' => null,
                'finish_state' => 'available_online',
                'reason_required' => false,
                'outcomes' => [],
            ],
        ];
    }

    private function assertErrorContains(array $errors, $needle)
    {
        foreach ($errors as $error) {
            if (strpos(strtolower($error['message']), strtolower($needle)) !== false) {
                return;
            }
        }
        $this->fail('Expected validation error containing: ' . $needle);
    }
}
