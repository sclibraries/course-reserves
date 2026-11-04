<?php

require_once __DIR__ . '/PublicationDestinationConcurrencySupervisor.php';
require_once __DIR__ . '/PublicationDestinationConcurrencyFixtureTracker.php';

use PHPUnit\Framework\Assert;

/**
 * Shared fixtures, worker control and assertions for the API-116B1 course-lock acceptance cases.
 *
 * Event histories are compared exactly ("phase:attempt[:table|:mysql_code]"), so an unexpected retry, a failed
 * attempt or a missing barrier fails every case (C11).
 */
abstract class Api116B1ConcurrencyCase
{
    protected $tracker;
    protected $supervisor;
    protected $offering;
    protected $otherOffering;
    protected $parentConnectionId;

    public function _before(ConcurrencyTester $I)
    {
        $prefix = 'test-api116b1-' . substr(md5(uniqid('', true)), 0, 10) . '-';
        $this->supervisor = new PublicationDestinationConcurrencySupervisor();
        $this->tracker = new PublicationDestinationConcurrencyFixtureTracker($prefix);
        $this->offering = $this->tracker->fixture()->createOffering('main');
        $this->otherOffering = $this->tracker->fixture()->createOffering('other');
        $this->parentConnectionId = (int)\Yii::$app->db->createCommand('SELECT CONNECTION_ID()')->queryScalar();
    }

    public function _after(ConcurrencyTester $I)
    {
        if ($this->tracker !== null) {
            $this->tracker->cleanup($this->supervisor);
        }
    }

    protected function item($suffix, $offeringId = null, $representation = 'new')
    {
        $item = $this->tracker->fixture()->createItem($suffix, $offeringId ?? $this->offering, $representation);
        $this->tracker->trackItem($item);
        return $item;
    }

    protected function electronic($suffix, $offeringId = null)
    {
        $pointer = $this->tracker->fixture()->createElectronicDestination($offeringId ?? $this->offering, $suffix);
        $this->tracker->trackPointer($pointer);
        return $pointer;
    }

    protected function physical($suffix, $instance, $offeringId = null)
    {
        $pointer = $this->tracker->fixture()->createPhysicalDestination($offeringId ?? $this->offering, $suffix, $instance);
        $this->tracker->trackPointer($pointer);
        return $pointer;
    }

    protected function setIdentity(array $item, $instanceId)
    {
        $table = $item['kind'] === 'new' ? 'submission_new_resources' : 'submission_reuse_resources';
        $input = ['version' => 1, 'title' => 'Synthetic frozen input', 'eds' => ['an' => Api116AFixture::accession($instanceId)]];
        $values = ['staff_corrections_json' => '{"title":"Synthetic correction"}'];
        if ($item['kind'] === 'new') {
            $values['resource_data'] = json_encode(['title' => 'Synthetic draft input', 'eds' => $input['eds']]);
            $values['source_snapshot_json'] = json_encode(['version' => 1, 'title' => 'Synthetic frozen input']);
        } else {
            $values['source_snapshot_json'] = json_encode($input);
        }
        \Yii::$app->db->createCommand()->update($table, $values, ['id' => $item['id']])->execute();
    }

    protected function instanceId()
    {
        return '10000000-0000-4000-8000-' . substr(md5(uniqid('', true)), 0, 12);
    }

    protected function startOperation($label, $operation, array $payload)
    {
        $payload['op'] = $operation;
        $payload['manifest'] = $this->tracker->manifest();
        $this->supervisor->start($label, $payload);
        $ready = $this->supervisor->awaitPhase($label, 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, (int)$ready['connection_id']);
        Assert::assertSame('reserves_test', $ready['database']);
        Assert::assertSame('REPEATABLE-READ', $ready['isolation_level']);
        Assert::assertSame(10, (int)$ready['lock_wait_timeout']);
        $this->supervisor->release($label, 'ready', 0);
        return $ready;
    }

    protected function runOperation($label, $operation, array $payload)
    {
        $ready = $this->startOperation($label, $operation, $payload);
        $result = $this->supervisor->complete($label);
        $result['connection_id'] = (int)$ready['connection_id'];
        return $result;
    }

    /** Starts a worker and acknowledges its barriers until it waits at the given phase. */
    protected function pauseAt($label, $operation, array $payload, $phase)
    {
        $this->startOperation($label, $operation, $payload);
        return $this->supervisor->advanceToPhase($label, $phase);
    }

    /** Releases a worker that waits at discovery, then proves it does not reach its lock while another holds it. */
    protected function releaseIntoBlock($label)
    {
        $this->supervisor->release($label, 'discovered', 1);
        $this->supervisor->assertSilent($label, 1.5);
    }

    protected function lockProbe($kind, $id)
    {
        return $this->runOperation('probe-' . $kind . '-' . $id . '-' . uniqid(), 'lock_probe', [
            'row' => ['kind' => $kind, 'id' => $id],
        ])['result'];
    }

    protected function assertContended(array $probe)
    {
        Assert::assertSame('contended', $probe['outcome']);
        Assert::assertSame(1205, $probe['mysql_code']);
    }

    protected function assertStatus(array $frame, $status, $errorCode = null)
    {
        $result = $frame['result']['registry'] ?? $frame['result'];
        Assert::assertSame($status, $result['status'] ?? null, 'Registry result: ' . json_encode($frame['result']));
        if ($errorCode !== null) {
            Assert::assertSame($errorCode, $result['body']['error_code']);
        }
    }

    /** One attempt's barrier sequence; inserts are 'dest' and/or 'attach'. Nested calls neither commit nor report it. */
    protected function attempt($n, array $inserts = [], $commit = true)
    {
        $events = ['attempt_started:' . $n, 'discovered:' . $n, 'locked:' . $n];
        foreach ($inserts as $insert) {
            $events[] = 'before_insert:' . $n . ':' . ($insert === 'dest' ? 'publication_destinations' : 'publication_attachments');
        }
        return $commit ? array_merge($events, ['before_commit:' . $n, 'committed:' . $n]) : $events;
    }

    protected function failedAttempt($n, array $inserts, $mysqlCode)
    {
        return array_merge($this->attempt($n, $inserts, false), ['attempt_failed:' . $n . ':' . $mysqlCode]);
    }

    protected function assertHistory($label, array $expected)
    {
        $events = [];
        foreach ($this->supervisor->history($label) as $frame) {
            if (in_array($frame['phase'], ['ready', 'result'], true)) {
                continue;
            }
            $context = $frame['context'] ?? [];
            $event = $frame['phase'] . ':' . (int)$frame['attempt'];
            if ($frame['phase'] === 'before_insert') {
                $event .= ':' . ($context['table'] ?? '?');
            }
            if (in_array($frame['phase'], ['attempt_failed', 'recovery_entered'], true)) {
                $event .= ':' . ($context['mysql_code'] ?? '?');
            }
            if ($frame['phase'] === 'attempt_started') {
                foreach (['query_offset', 'call_id', 'depth'] as $key) {
                    Assert::assertTrue(is_int($context[$key] ?? null), 'attempt_started lacks ' . $key);
                }
            }
            $events[] = $event;
        }
        Assert::assertSame($expected, $events, 'Complete event history of ' . $label);
    }

    /** Executed SQL of each attempt, split at the query offsets reported by attempt_started. */
    protected function attemptQueries($label, array $resultFrame)
    {
        $offsets = [];
        foreach ($this->supervisor->history($label) as $frame) {
            if ($frame['phase'] === 'attempt_started') {
                $offsets[] = (int)$frame['context']['query_offset'];
            }
        }
        Assert::assertNotEmpty($offsets, 'No attempt_started query offsets from ' . $label);
        $slices = [];
        foreach ($offsets as $index => $offset) {
            $end = $offsets[$index + 1] ?? count($resultFrame['queries']);
            $slices[] = array_slice($resultFrame['queries'], $offset, $end - $offset);
        }
        return $slices;
    }

    protected function firstLockingStatement(array $queries)
    {
        foreach ($queries as $query) {
            if (preg_match('/\b(FOR\s+UPDATE|LOCK\s+IN\s+SHARE\s+MODE)\b/i', $query)
                || preg_match('/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i', $query)) {
                return $query;
            }
        }
        return null;
    }

    /** C6: discovery included, every attempt's first locking statement is the ascending course lock. */
    protected function assertCourseLockFirst($label, array $resultFrame, array $offeringIds)
    {
        sort($offeringIds, SORT_NUMERIC);
        foreach ($this->attemptQueries($label, $resultFrame) as $index => $queries) {
            $first = (string)$this->firstLockingStatement($queries);
            Assert::assertSame(1, preg_match(
                '/\bFROM\s+`?course_offerings`?\s+WHERE\s+`?offering_id`?\s+IN\s*\(([^)]*)\)\s+ORDER\s+BY\s+`?offering_id`?\s+FOR\s+UPDATE\b/i',
                $first,
                $match
            ), $label . ' attempt ' . ($index + 1) . ' must lock its course first, got: ' . $first);
            preg_match_all('/\d+/', $match[1], $ids);
            Assert::assertSame($offeringIds, array_map('intval', $ids[0]), 'Course lock ids, ascending: ' . $first);
        }
    }

    /** C6 no-course paths: the first locking statement is a FOR UPDATE on the named row. */
    protected function assertRowLockFirst($label, array $resultFrame, $table, $column, $id)
    {
        foreach ($this->attemptQueries($label, $resultFrame) as $index => $queries) {
            $first = (string)$this->firstLockingStatement($queries);
            Assert::assertSame(1, preg_match(
                '/\bFROM\s+`?' . $table . '`?\s+WHERE\s+`?' . $column . '`?\s*(=\s*\'?' . (int)$id . '\'?|IN\s*\(\s*\'?'
                . (int)$id . '\'?\s*\))(?!\d).*\bFOR\s+UPDATE\b/is',
                $first
            ), $label . ' attempt ' . ($index + 1) . ' must lock ' . $table . ' ' . $id . ' first, got: ' . $first);
        }
    }

    protected function assertGapLockingDatabase()
    {
        $settings = \Yii::$app->db->createCommand(
            'SELECT @@GLOBAL.tx_isolation AS isolation, @@GLOBAL.innodb_locks_unsafe_for_binlog AS unsafe, '
            . '@@GLOBAL.innodb_deadlock_detect AS detect'
        )->queryOne();
        Assert::assertSame(['isolation' => 'REPEATABLE-READ', 'unsafe' => '0', 'detect' => '1'], array_map('strval', $settings));
    }

    protected function row($table, $where, array $params)
    {
        $row = \Yii::$app->db->createCommand('SELECT * FROM `' . $table . '` WHERE ' . $where, $params)->queryOne();
        return $row === false ? null : $row;
    }

    protected function destinationRow($id)
    {
        return $this->row('publication_destinations', 'id = :id', [':id' => $id]);
    }

    protected function stateRow(array $item)
    {
        return $this->row('submission_publication_state', 'item_kind = :kind AND item_id = :id', [
            ':kind' => $item['kind'], ':id' => $item['id'],
        ]);
    }

    protected function attachmentRows(array $item)
    {
        return \Yii::$app->db->createCommand(
            'SELECT * FROM publication_attachments WHERE item_kind = :kind AND item_id = :id ORDER BY id',
            [':kind' => $item['kind'], ':id' => $item['id']]
        )->queryAll();
    }

    protected function rowsForPointer(array $pointer)
    {
        $column = $pointer['destination_kind'] === 'electronic' ? 'course_resource_id' : 'physical_reference_id';
        return \Yii::$app->db->createCommand(
            'SELECT * FROM publication_destinations WHERE `' . $column . '` = :id', [':id' => $pointer[$column]]
        )->queryAll();
    }

    /** The attachment snapshot is the named electronic entry's live content. */
    protected function assertElectronicSnapshot(array $attachment, array $pointer, $name)
    {
        $snapshot = json_decode($attachment['attached_snapshot_json'], true);
        Assert::assertSame('electronic', $snapshot['destination_kind']);
        Assert::assertSame($pointer['course_resource_id'], (int)$snapshot['course_resource_id']);
        Assert::assertSame($pointer['resource_id'], (int)$snapshot['resource_id']);
        Assert::assertSame($name, $snapshot['name']);
    }
}
