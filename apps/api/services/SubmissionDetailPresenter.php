<?php

namespace app\services;

use Yii;

/** Adds batched readiness and item-flow summaries to staff submission details. */
class SubmissionDetailPresenter
{
    private $folioService;
    private $flows;
    private $flowStatePresenter;
    private $publication;

    public function __construct($folioService = null, $flows = null)
    {
        $this->folioService = $folioService ?: Yii::$container->get(FolioService::class);
        $this->flows = $flows ?: Yii::$container->get(FlowRepository::class);
        $this->flowStatePresenter = new FlowStatePresenter($this->flows);
        $this->publication = Yii::$container->get(SubmissionPublicationStateService::class);
    }

    public function present(array $submission, $actor = null)
    {
        $entry = Yii::$app->db->createCommand(
            'SELECT entered_by, entry_source FROM faculty_submissions WHERE submission_id = :id',
            [':id' => (int)($submission['submission_id'] ?? 0)]
        )->queryOne();
        $submission['entered_by'] = $entry['entered_by'] ?? null;
        $submission['entry_source'] = $entry['entry_source'] ?? null;

        $collections = ['newResources' => 'new', 'reuseResources' => 'reuse'];
        $claimFields = Yii::$container->get(ItemClaimService::class)->claimsForSubmission(
            (int)($submission['submission_id'] ?? 0)
        );
        $instanceIds = [];
        $catalogInstanceIds = [];
        $flowItems = [];
        foreach ($collections as $collection => $kind) {
            foreach ($submission[$collection] ?? [] as $index => $item) {
                if (!is_array($item)) {
                    continue;
                }
                $itemId = (int)($item['id'] ?? 0);
                if (isset($claimFields[$kind][$itemId])) {
                    unset($item['claimed_by_staff_id'], $item['assigned_group_id']);
                    $item = array_merge($item, $claimFields[$kind][$itemId]);
                    $submission[$collection][$index] = $item;
                }
                $instanceId = ItemReadiness::catalogInstanceId($item);
                $catalogInstanceIds[$collection][$index] = $instanceId;
                if ($instanceId !== null) {
                    $instanceIds[$instanceId] = true;
                }
                if ($itemId > 0) {
                    $flowItems[] = ['kind' => $kind, 'id' => $itemId];
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
                    $this->logAvailabilityFailure('instance ids not returned=' . implode(', ', array_keys($lookupFailures)));
                }
            } catch (\Throwable $exception) {
                $availability = [];
                $lookupFailures = $instanceIds;
                $this->logAvailabilityFailure('exception=' . $exception->getMessage());
            }
        }

        $flowRuns = [];
        if ($flowItems) {
            foreach ($this->flows->latestRunsForItems($flowItems) as $run) {
                $flowRuns[$run['item_kind'] . ':' . $run['item_id']] = $run;
            }
        }
        $materialTypeIds = [];
        foreach ($collections as $collection => $kind) {
            foreach ($submission[$collection] ?? [] as $index => $item) {
                if (!is_array($item) || isset($flowRuns[$kind . ':' . (int)($item['id'] ?? 0)])) {
                    continue;
                }
                $materialTypeId = (int)($item['material_type_id'] ?? 0);
                if ($materialTypeId > 0) {
                    $materialTypeIds[$materialTypeId] = true;
                }
            }
        }
        $mappedFlows = [];
        if ($materialTypeIds) {
            foreach ($this->flows->mappedFlowsForMaterialTypes(array_keys($materialTypeIds)) as $mappedFlow) {
                $mappedFlows[(int)$mappedFlow['material_type_id']] = $mappedFlow;
            }
        }

        $publicationItems = [];
        foreach ($collections as $collection => $kind) {
            foreach ($submission[$collection] ?? [] as $item) {
                if (is_array($item) && (int)($item['id'] ?? 0) > 0) {
                    $publicationItems[] = [
                        'kind' => $kind,
                        'id' => (int)$item['id'],
                        'item' => $item,
                    ];
                }
            }
        }
        $publicationContracts = [];
        if ($actor !== null) {
            $publicationContracts = $this->publication->contractsForSubmission(
                (int)($submission['submission_id'] ?? 0), $publicationItems, [
                    'username' => $actor->username ?? (string)$actor->id,
                    'role' => $actor->role,
                ], $flowRuns, $mappedFlows
            );
        }

        foreach ($collections as $collection => $kind) {
            foreach ($submission[$collection] ?? [] as $index => $item) {
                if (!is_array($item)) {
                    continue;
                }
                $instanceId = $catalogInstanceIds[$collection][$index] ?? null;
                $itemAvailability = $instanceId !== null && !isset($lookupFailures[$instanceId])
                    ? ($availability[$instanceId] ?? null)
                    : null;
                if ($instanceId !== null && isset($lookupFailures[$instanceId])) {
                    $itemAvailability = ['error' => true];
                }

                $flowKey = $kind . ':' . (int)($item['id'] ?? 0);
                $run = $flowRuns[$flowKey] ?? null;
                $item = array_merge(
                    $item,
                    ItemReadiness::evaluate($item, $itemAvailability, $instanceId, $run)
                );
                $item['allowed_access_paths'] = AccessPathPolicy::allowedForItem($item);
                $mappedFlow = $run ? null : ($mappedFlows[(int)($item['material_type_id'] ?? 0)] ?? null);
                $item['flow'] = $this->flowStatePresenter->summary($run, $mappedFlow);
                $item['publication'] = $publicationContracts[$flowKey] ?? null;
                $submission[$collection][$index] = $item;
            }
        }

        return $submission;
    }

    private function logAvailabilityFailure($detail)
    {
        $reference = Yii::$app->security->generateRandomString(12);
        $detail = str_replace(["\r", "\n"], ' ', $detail);
        Yii::error('Submission detail FOLIO availability failed. reference=' . $reference . ' detail=' . $detail);
    }
}
