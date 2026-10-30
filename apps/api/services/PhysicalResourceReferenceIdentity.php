<?php

namespace app\services;

use app\components\FolioInstanceId;

/** Resolves canonical physical identity only from evidence tied to a submission item. */
class PhysicalResourceReferenceIdentity
{
    public function resolve($kind, array $item)
    {
        $snapshotField = $kind === 'reuse' ? 'source_snapshot_json' : 'resource_data';
        $data = $this->decode($item[$snapshotField] ?? null);
        $eds = isset($data['eds']) && is_array($data['eds']) ? $data['eds'] : [];
        $accession = $this->value($eds['an'] ?? null);
        $parsedId = FolioInstanceId::fromAccessionNumber($accession);
        $sourceId = $this->normalizedId($item['source_folio_instance_id'] ?? null);
        $establishedId = $this->normalizedId($item['established_folio_instance_id'] ?? null);
        list($legacyIdentifier, $legacyType) = $this->legacyIdentifier($item);
        $conflict = ($parsedId !== null && (
            ($sourceId !== null && $sourceId !== $parsedId)
            || ($establishedId !== null && $establishedId !== $parsedId)
        )) || ($parsedId === null && $establishedId !== null && $sourceId !== null && $sourceId !== $establishedId);

        $instanceId = null;
        $evidenceSource = null;
        $matchedField = null;
        $matchedValue = null;
        $reason = null;
        if ($conflict) {
            $evidenceSource = $parsedId !== null ? 'eds_accession_parser' : 'established_item_identity';
            $matchedField = $parsedId !== null
                ? $snapshotField . '.eds.an'
                : 'source_folio_instance_id';
            $matchedValue = $parsedId !== null ? $accession : $sourceId;
            $reason = 'conflicting_evidence';
        } elseif ($parsedId !== null) {
            $instanceId = $parsedId;
            $evidenceSource = 'eds_accession_parser';
            $matchedField = $snapshotField . '.eds.an';
            $matchedValue = $accession;
        } elseif ($establishedId !== null && $sourceId === $establishedId) {
            $instanceId = $establishedId;
            $evidenceSource = 'established_item_identity';
            $matchedField = 'source_folio_instance_id';
            $matchedValue = $sourceId;
        } else {
            $evidenceSource = $accession !== null
                ? 'eds_accession_parser'
                : ($sourceId !== null ? 'source_folio_instance_id' : 'legacy_identifier');
            $matchedField = $accession !== null
                ? $snapshotField . '.eds.an'
                : ($sourceId !== null ? 'source_folio_instance_id' : $this->legacyField($item));
            $matchedValue = $accession !== null ? $accession : ($sourceId !== null ? $sourceId : $legacyIdentifier);
            $reason = $accession !== null ? 'unrecognized_accession' : 'no_trusted_instance_evidence';
        }

        $verified = $instanceId !== null && !$conflict;
        if ($verified && $legacyType === 'instance' && strtolower($legacyIdentifier) === strtolower($instanceId)) {
            $legacyIdentifier = null;
            $legacyType = 'unknown';
        }
        $provenance = [
            'evidence_source' => $evidenceSource,
            'item_kind' => in_array($kind, ['new', 'reuse'], true) ? $kind : null,
            'item_id' => isset($item['id']) ? (int)$item['id'] : null,
            'matched_field' => $matchedField,
            'matched_value' => $matchedValue,
            'outcome' => $verified ? 'verified' : 'unverified',
            'reason' => $reason,
        ];

        $blockers = [];
        $destinationClass = $item['destination_class'] ?? 'print';
        if ($destinationClass === 'print' && !$verified) {
            $blockers[] = 'physical_identity_required';
        }

        return [
            'identity_status' => $verified ? 'verified' : 'unverified',
            'folio_instance_id' => $instanceId,
            'external_resource_id' => $verified ? $instanceId : $legacyIdentifier,
            'legacy_identifier' => $legacyIdentifier,
            'legacy_identifier_type' => $legacyType,
            'provenance' => $provenance,
            'blockers' => $blockers,
        ];
    }

    private function legacyIdentifier(array $item)
    {
        foreach ([['source_barcode', 'barcode'], ['source_folio_instance_id', 'instance'], ['external_resource_id', null]] as $source) {
            $value = $this->value($item[$source[0]] ?? null);
            if ($value !== null) {
                return [$value, $source[1] ?: ($this->isUuid($value) ? 'instance' : 'barcode')];
            }
        }

        return [null, 'unknown'];
    }

    private function legacyField(array $item)
    {
        if ($this->value($item['source_barcode'] ?? ($item['barcode'] ?? null)) !== null) {
            return isset($item['source_barcode']) ? 'source_barcode' : 'barcode';
        }
        return isset($item['external_resource_id']) ? 'external_resource_id' : null;
    }

    private function decode($value)
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }
        return is_array($value) ? $value : [];
    }

    private function normalizedId($value)
    {
        $value = $this->value($value);
        return $value === null ? null : strtolower($value);
    }

    private function value($value)
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    private function isUuid($value)
    {
        return preg_match('/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i', $value) === 1;
    }
}
