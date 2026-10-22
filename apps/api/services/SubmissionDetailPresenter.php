<?php

namespace app\services;

use Yii;

/** Adds batched readiness and item-flow summaries to staff submission details. */
class SubmissionDetailPresenter
{
    private $folioService;
    private $flowRunner;

    public function __construct($folioService = null, $flowRunner = null)
    {
        $this->folioService = $folioService ?: Yii::$container->get(FolioService::class);
        $this->flowRunner = $flowRunner ?: Yii::$container->get(FlowRunner::class);
    }

    public function present(array $submission, array $actor)
    {
        $collections = ['newResources' => 'new', 'reuseResources' => 'reuse'];
        $instanceIds = [];
        foreach ($collections as $collection => $kind) {
            foreach ($submission[$collection] ?? [] as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $instanceId = ItemReadiness::catalogInstanceId($item);
                if ($instanceId !== null) {
                    $instanceIds[$instanceId] = true;
                }
            }
        }

        $availability = [];
        $lookupFailures = [];
        if ($instanceIds) {
            try {
                $availability = $this->folioService->fetchAvailability(array_keys($instanceIds));
                if (!is_array($availability)) {
                    throw new \UnexpectedValueException('Invalid FOLIO availability response');
                }
                $lookupFailures = array_diff_key($instanceIds, $availability);
                if ($lookupFailures) {
                    $this->logAvailabilityFailure();
                }
            } catch (\Throwable $exception) {
                $availability = [];
                $lookupFailures = $instanceIds;
                $this->logAvailabilityFailure();
            }
        }

        foreach ($collections as $collection => $kind) {
            foreach ($submission[$collection] ?? [] as $index => $item) {
                if (!is_array($item)) {
                    continue;
                }
                $instanceId = ItemReadiness::catalogInstanceId($item);
                $itemAvailability = $instanceId !== null && !isset($lookupFailures[$instanceId])
                    ? ($availability[$instanceId] ?? null)
                    : null;
                if ($instanceId !== null && isset($lookupFailures[$instanceId])) {
                    $itemAvailability = ['error' => true];
                }

                $item = array_merge($item, ItemReadiness::evaluate($item, $itemAvailability));
                $item['flow'] = $this->flowSummary($kind, $item, $actor);
                $submission[$collection][$index] = $item;
            }
        }

        return $submission;
    }

    private function flowSummary($kind, array $item, array $actor)
    {
        $result = $this->flowRunner->getItemFlow($kind, (int)($item['id'] ?? 0), $actor);
        $state = $result['body'] ?? [];

        return [
            'name' => $state['flow']['name'] ?? null,
            'current_step_label' => $state['current_step']['step']['label'] ?? null,
            'finish_state' => $state['finished']['finish_state'] ?? null,
        ];
    }

    private function logAvailabilityFailure()
    {
        $reference = Yii::$app->security->generateRandomString(12);
        Yii::error('Submission detail FOLIO availability failed. reference=' . $reference);
    }
}
