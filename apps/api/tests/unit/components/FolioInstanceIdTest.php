<?php

namespace tests\unit\components;

use app\components\FolioInstanceId;

class FolioInstanceIdTest extends \Codeception\Test\Unit
{
    public function testParsesFiveCollegeAccessionUuidSuffix()
    {
        $an = 'scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.'
            . '00000000.0000.4000.8000.000000000886';

        $this->assertSame('00000000-0000-4000-8000-000000000886', FolioInstanceId::fromAccessionNumber($an));
    }

    public function testReturnsNullForNonFiveCollegeAndMalformedAccessionNumbers()
    {
        $this->assertNull(FolioInstanceId::fromAccessionNumber(
            'smc.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.00000000.0000.4000.8000.000000000886'
        ));
        $this->assertNull(FolioInstanceId::fromAccessionNumber('junk'));
        $this->assertNull(FolioInstanceId::fromAccessionNumber(
            'scf.oai.edge.fivecolleges.folio.ebsco.com.fs00001006.not-a-uuid'
        ));
    }
}
