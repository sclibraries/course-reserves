<?php

namespace tests\unit\database;

class Api114FreshSchemaTest extends \Codeception\Test\Unit
{
    public function testFreshSchemaIncludesNullableDestinationTextAndPhysicalVisibilityDefaults()
    {
        $repositoryRoot = dirname(dirname(codecept_root_dir()));
        $sql = file_get_contents($repositoryRoot . '/packages/database/schema.sql');
        $this->assertNotFalse($sql, 'The fresh-install schema must be readable.');

        $resources = $this->tableDefinition($sql, 'resources');
        $physical = $this->tableDefinition($sql, 'physical_resource_references');

        $this->assertMatchesRegularExpression('/`external_note`\s+(?:text|mediumtext)\s+DEFAULT NULL/i', $resources);
        $this->assertMatchesRegularExpression('/`assigned_pages`\s+text\s+DEFAULT NULL/i', $resources);
        $this->assertMatchesRegularExpression('/`public_note`\s+text\s+DEFAULT NULL/i', $physical);
        $this->assertMatchesRegularExpression('/`assigned_pages`\s+text\s+DEFAULT NULL/i', $physical);
        $this->assertMatchesRegularExpression('/`start_visibility`\s+date\s+DEFAULT NULL/i', $physical);
        $this->assertMatchesRegularExpression('/`end_visibility`\s+date\s+DEFAULT NULL/i', $physical);
        $this->assertMatchesRegularExpression('/`use_visibility`\s+tinyint\(1\)\s+NOT NULL\s+DEFAULT 0/i', $physical);
    }

    private function tableDefinition($sql, $table)
    {
        $pattern = '/CREATE TABLE `' . preg_quote($table, '/') . '` \((.*?)\) ENGINE=/s';
        $this->assertSame(1, preg_match($pattern, $sql, $matches), 'Missing ' . $table . ' table definition.');
        return $matches[1];
    }
}
