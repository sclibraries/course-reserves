<?php

namespace app\services;

use Yii;

/** Returns the current allowlisted draft input for one linked staff item. */
class SubmissionInputProjectionService
{
    use ServiceResult;

    private $claims;
    private $items;
    private $states;
    private $projection;

    public function __construct($claims = null, $items = null, $states = null, $projection = null)
    {
        $this->claims = $claims ?: Yii::$container->get(ItemClaimService::class);
        $this->items = $items ?: new ItemClaimRepository();
        $this->states = $states ?: new SubmissionPublicationStateRepository();
        $this->projection = $projection ?: new SubmissionInputProjection();
    }

    public function project($kind, $itemId)
    {
        return $this->claims->withLinkedItem($kind, $itemId, function ($item) use ($kind, $itemId) {
            $state = $this->states->find($kind, $itemId);
            $referenceId = (int)($item['materialized_physical_reference_id'] ?? 0);
            if ($referenceId > 0 && !empty($item['offering_id'])) {
                $item['established_folio_instance_id'] = Yii::$app->db->createCommand(
                    'SELECT folio_instance_id FROM physical_resource_references '
                    . 'WHERE reference_id = :reference AND offering_id = :offering '
                    . 'AND identity_status = "verified" LIMIT 1', [
                        ':reference' => $referenceId,
                        ':offering' => $item['offering_id'],
                    ]
                )->queryScalar() ?: null;
            }
            $hasSource = $item['source_resource_id'] !== null
                && trim((string)$item['source_resource_id']) !== '';
            $sourceExists = !$hasSource || $item['source_resource_found'] !== null;
            return $this->result(200, [
                'projection' => $this->projection->project(
                    $kind,
                    $item,
                    $item['material_type'] ?? null,
                    $state['published_snapshot'] ?? null,
                    $sourceExists
                ),
            ]);
        });
    }
}
