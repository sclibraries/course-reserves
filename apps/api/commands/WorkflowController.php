<?php

namespace app\commands;

use app\services\LinkSuggestionService;
use app\services\ItemClaimService;
use app\services\ItemContention;
use Yii;
use yii\console\Controller;
use yii\console\ExitCode;

/** Runs the scheduled full sweep or drains stale checks queued by the needs-linking list. */
class WorkflowController extends Controller
{
    public $limit = 0;
    public $queuedOnly = false;

    public function options($actionID)
    {
        return array_merge(parent::options($actionID), ['limit', 'queuedOnly']);
    }

    public function actionCheckLinks()
    {
        $actor = ['username' => 'workflow/check-links', 'role' => 'system'];
        $counts = Yii::$container->get(LinkSuggestionService::class)->runChecks(
            (bool)$this->queuedOnly,
            max(0, (int)$this->limit),
            $actor
        );
        $this->stdout(json_encode($counts) . "\n");
        return $counts['errors'] > 0 ? ExitCode::UNSPECIFIED_ERROR : ExitCode::OK;
    }

    public function actionExpireClaims()
    {
        $claims = Yii::$container->get(ItemClaimService::class);
        $expired = 0;
        foreach ($claims->expiredClaimCandidates() as $reference) {
            try {
                $expired += $claims->expireCandidate($reference) ? 1 : 0;
            } catch (ItemContention $exception) {
                Yii::error('Claim expiry contention reference=' . $exception->reference, __METHOD__);
            }
        }
        $this->stdout($expired . " claims expired\n");
        return ExitCode::OK;
    }
}
