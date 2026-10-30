<?php

namespace tests\unit\models;

use app\models\PhysicalResourceReferences;
use app\models\Resources;

class Api114PhysicalVisibilityTest extends \Codeception\Test\Unit
{
    public function testPhysicalVisibilityDefaultsToDisabledWithNullableDates()
    {
        $reference = new PhysicalResourceReferences();

        $this->assertContains('public_note', $reference->attributes());
        $this->assertContains('assigned_pages', $reference->attributes());
        $this->assertContains('start_visibility', $reference->attributes());
        $this->assertContains('end_visibility', $reference->attributes());
        $this->assertContains('use_visibility', $reference->attributes());

        $reference->loadDefaultValues();
        $this->assertSame(0, (int)$reference->use_visibility);
        $this->assertNull($reference->start_visibility);
        $this->assertNull($reference->end_visibility);
        $this->assertNull($reference->public_note);
        $this->assertNull($reference->assigned_pages);
    }

    public function testPhysicalVisibilityAllowsOneSidedWindowsAndRejectsInvalidDatesAndRanges()
    {
        $startOnly = $this->reference([
            'use_visibility' => 1,
            'start_visibility' => '2026-11-01',
            'end_visibility' => null,
        ]);
        $endOnly = $this->reference([
            'use_visibility' => 1,
            'start_visibility' => null,
            'end_visibility' => '2026-11-30',
        ]);
        $disabled = $this->reference([
            'use_visibility' => 0,
            'start_visibility' => '2026-11-01',
            'end_visibility' => '2026-11-30',
        ]);
        $invalidDate = $this->reference([
            'use_visibility' => 1,
            'start_visibility' => 'not-a-date',
            'end_visibility' => null,
        ]);
        $unpaddedDate = $this->reference([
            'use_visibility' => 1,
            'start_visibility' => '2026-2-01',
            'end_visibility' => null,
        ]);
        $invalidRange = $this->reference([
            'use_visibility' => 1,
            'start_visibility' => '2026-11-30',
            'end_visibility' => '2026-11-01',
        ]);
        $invalidFlag = $this->reference([
            'use_visibility' => 2,
            'start_visibility' => null,
            'end_visibility' => null,
        ]);

        $this->assertTrue($startOnly->validate(['use_visibility', 'start_visibility', 'end_visibility']));
        $this->assertTrue($endOnly->validate(['use_visibility', 'start_visibility', 'end_visibility']));
        $this->assertTrue($disabled->validate(['use_visibility', 'start_visibility', 'end_visibility']));
        $this->assertFalse($invalidDate->validate(['use_visibility', 'start_visibility', 'end_visibility']));
        $this->assertFalse($unpaddedDate->validate(['use_visibility', 'start_visibility', 'end_visibility']));
        $this->assertFalse($invalidRange->validate(['use_visibility', 'start_visibility', 'end_visibility']));
        $this->assertFalse($invalidFlag->validate(['use_visibility']));
    }

    public function testPhysicalDestinationNotesAndPagesAcceptNullableTextOnly()
    {
        $valid = $this->reference([
            'public_note' => 'Synthetic public note',
            'assigned_pages' => '4-8',
        ]);
        $invalidNote = $this->reference(['public_note' => ['structured' => 'value']]);
        $invalidPages = $this->reference(['assigned_pages' => ['structured' => 'value']]);

        $this->assertTrue($valid->validate(['public_note', 'assigned_pages']));
        $this->assertFalse($invalidNote->validate(['public_note']));
        $this->assertFalse($invalidPages->validate(['assigned_pages']));
    }

    public function testElectronicDestinationKeepsPublicNoteAndAddsNullableAssignedPagesText()
    {
        $resource = new Resources();
        $this->assertContains('external_note', $resource->attributes());
        $this->assertContains('assigned_pages', $resource->attributes());

        $resource->external_note = 'Synthetic existing public note';
        $resource->assigned_pages = '10-12';
        $this->assertTrue($resource->validate(['external_note', 'assigned_pages']));

        $resource->assigned_pages = ['structured' => 'value'];
        $this->assertFalse($resource->validate(['assigned_pages']));
    }

    private function reference(array $values)
    {
        $reference = new PhysicalResourceReferences();
        $reference->setAttributes($values, false);
        return $reference;
    }
}
