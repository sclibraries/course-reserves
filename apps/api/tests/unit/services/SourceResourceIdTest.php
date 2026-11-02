<?php

namespace tests\unit\services;

use app\services\SourceResourceId;
use Yii;

class SourceResourceIdTest extends \Codeception\Test\Unit
{
    public function testCanonicalHelperUsesOneCaseTable()
    {
        foreach ($this->cases() as $case) {
            list($label, $value, $expected) = $case;
            $this->assertSame($expected, SourceResourceId::canonical($value), $label);
        }
    }

    public function testProtectionApi116ASourceLookupHonorsSignedIntAndUuidBoundaries()
    {
        $this->assertSame(1, SourceResourceId::canonical('1'));
        $this->assertSame(2147483647, SourceResourceId::canonical('2147483647'));
        $this->assertNull(SourceResourceId::canonical('2147483648'));
        $this->assertNull(SourceResourceId::canonical('81390788-f8c0-4000-8000-000000001164'));
        $this->assertNull(SourceResourceId::canonical('4e5a0000-0000-4000-8000-000000001164'));
    }

    public function testSqlExpressionMatchesTheSameCaseTableWithoutWarnings()
    {
        $expression = SourceResourceId::sqlValue('source_value.raw_value');
        foreach ($this->cases() as $case) {
            list($label, $value, $expected) = $case;
            $actual = Yii::$app->db->createCommand(
                'SELECT ' . $expression . ' FROM (SELECT :source_value AS raw_value) source_value',
                [':source_value' => $value]
            )->queryScalar();
            $expectedSql = $expected === null ? null : (string)$expected;
            $actualSql = $actual === null ? null : (string)$actual;
            $this->assertSame($expectedSql, $actualSql, $label);
            $warnings = Yii::$app->db->createCommand('SHOW WARNINGS')->queryAll();
            $this->assertSame([], $warnings, $label . ' must not emit SQL warnings');
        }
    }

    private function cases()
    {
        return [
            ['zero integer', 0, null],
            ['zero string', '0', null],
            ['leading zero', '00044', null],
            ['canonical numeric string', '44', 44],
            ['signed INT maximum', '2147483647', 2147483647],
            ['signed INT maximum plus one', '2147483648', null],
            ['eleven digit value', '12345678901', null],
            ['trailing newline', "44\n", null],
            ['positive sign', '+44', null],
            ['negative sign', '-44', null],
            ['leading space', ' 44', null],
            ['trailing space', '44 ', null],
            ['exponent', '1e3', null],
            ['digit-led UUID', '81390788-f8c0-4000-8000-000000000118', null],
            ['4e5-led UUID', '4e5a0000-0000-4000-8000-000000000118', null],
            ['PHP integer', 44, 44],
            ['PHP signed INT maximum', 2147483647, 2147483647],
            ['PHP integer above signed INT', 2147483648, null],
            ['null', null, null],
            ['empty string', '', null],
        ];
    }
}
