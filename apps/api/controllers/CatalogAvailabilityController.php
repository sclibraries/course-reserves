<?php

namespace app\controllers;

use app\components\FolioInstanceId;
use app\services\FolioService;
use Yii;

/** Authenticated availability lookup for catalog accession numbers. */
class CatalogAvailabilityController extends BaseRestController
{
    public function behaviors()
    {
        $behaviors = parent::behaviors();

        return $behaviors;
    }

    /**
     * Return holdings keyed by each requested EDS accession number.
     *
     * @return array
     */
    public function actionIndex()
    {
        $accessionNumbers = $this->requestedAccessionNumbers(Yii::$app->request->get('an'));
        if ($accessionNumbers === null) {
            Yii::$app->response->statusCode = 400;
            return ['error_code' => 'invalid_request'];
        }

        $instanceByAccession = [];
        $instanceIds = [];
        foreach ($accessionNumbers as $accessionNumber) {
            $instanceId = FolioInstanceId::fromAccessionNumber($accessionNumber);
            $instanceByAccession[$accessionNumber] = $instanceId;
            if ($instanceId !== null) {
                $instanceIds[] = $instanceId;
            }
        }

        $availabilityByInstance = [];
        if (!empty($instanceIds)) {
            $availabilityByInstance = Yii::$container->get(FolioService::class)
                ->fetchAvailability(array_values(array_unique($instanceIds)));
        }

        $records = [];
        foreach ($instanceByAccession as $accessionNumber => $instanceId) {
            if ($instanceId === null) {
                $records[$accessionNumber] = ['instanceId' => null, 'copies' => []];
                continue;
            }

            $availability = $availabilityByInstance[$instanceId];
            if (isset($availability['error']) && $availability['error'] === true) {
                $records[$accessionNumber] = [
                    'instanceId' => $instanceId,
                    'error' => true,
                    'reference' => $availability['reference'],
                ];
                continue;
            }

            $records[$accessionNumber] = [
                'instanceId' => $instanceId,
                'copies' => $availability,
            ];
        }

        return ['records' => $records];
    }

    /**
     * OPTIONS is intercepted by BaseRestController before authentication.
     *
     * @return null
     */
    public function actionOptions()
    {
        return null;
    }

    /**
     * @param mixed $value
     * @return array|null
     */
    private function requestedAccessionNumbers($value)
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        $accessionNumbers = array_map('trim', explode(',', $value));
        if (count($accessionNumbers) > 20 || in_array('', $accessionNumbers, true)) {
            return null;
        }

        return $accessionNumbers;
    }
}
