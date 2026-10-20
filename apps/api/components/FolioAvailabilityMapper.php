<?php

namespace app\components;

/** Maps middleware holdings to the public catalog-copy fields. */
class FolioAvailabilityMapper
{
    /**
     * @param array $holdings
     * @return array
     */
    public static function copiesFromHoldings(array $holdings)
    {
        $copies = [];
        foreach ($holdings as $holding) {
            if (isset($holding['suppressFromDiscovery']) && $holding['suppressFromDiscovery'] === 'true') {
                continue;
            }
            $copies[] = [
                'library' => isset($holding['library']['name']) ? $holding['library']['name'] : null,
                'location' => isset($holding['location']) ? $holding['location'] : null,
                'callNumber' => isset($holding['callNumber']) ? $holding['callNumber'] : null,
                'status' => isset($holding['status']) ? $holding['status'] : null,
                'loanType' => isset($holding['permanentLoanType']) ? $holding['permanentLoanType'] : null,
            ];
        }

        return $copies;
    }
}
