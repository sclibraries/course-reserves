<?php

require_once __DIR__ . '/../_support/concurrency/Api116B1ConcurrencyCase.php';

use PHPUnit\Framework\Assert;

/** Harness and database preflight; this file sorts first, so the suite fails closed before any race case runs. */
class Api116B1ConcurrencyCest extends Api116B1ConcurrencyCase
{
    /** The first suite test fails closed when proc_open or framed pipes are unavailable. */
    public function test00PreflightRequiresProcOpenAndARealPipeRoundTrip(ConcurrencyTester $I)
    {
        Assert::assertTrue(function_exists('proc_open'), 'The test image must provide proc_open.');
        $this->supervisor->start('preflight', ['op' => 'preflight']);
        $ready = $this->supervisor->awaitPhase('preflight', 'ready', 0);
        Assert::assertNotSame($this->parentConnectionId, $ready['connection_id']);
        $this->supervisor->release('preflight', 'ready', 0);
        $result = $this->supervisor->complete('preflight');
        Assert::assertSame(['round_trip' => true], $result['result']);
        Assert::assertSame(['ready', 'result'], array_column($this->supervisor->history('preflight'), 'phase'));
    }

    /** C7 preflight: next-key locking and immediate deadlock detection are prerequisites of the protocol. */
    public function test01PreflightRequiresRepeatableReadGapLocksAndDeadlockDetection(ConcurrencyTester $I)
    {
        $this->assertGapLockingDatabase();
    }

    public function testHarnessRejectsMalformedFramesMissingResultsAndDeadlines(ConcurrencyTester $I)
    {
        $this->supervisor->start('malformed', ['op' => 'harness_malformed']);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('malformed');
        }, 'Malformed concurrency frame');

        $this->supervisor->start('eof', ['op' => 'harness_eof']);
        $this->supervisor->awaitPhase('eof', 'ready', 0);
        $this->supervisor->release('eof', 'ready', 0);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('eof');
        }, 'EOF before the expected phase');

        $this->supervisor = new PublicationDestinationConcurrencySupervisor(1);
        $this->supervisor->start('deadline', ['op' => 'harness_stall']);
        $this->supervisor->awaitPhase('deadline', 'ready', 0);
        $this->supervisor->release('deadline', 'ready', 0);
        $this->expectSupervisorFailure(function () {
            $this->supervisor->next('deadline');
        }, 'deadline exceeded');
        Assert::assertTrue($this->supervisor->allReaped());
    }

    private function expectSupervisorFailure(callable $callback, $message)
    {
        try {
            call_user_func($callback);
            Assert::fail('Expected concurrency harness failure containing: ' . $message);
        } catch (\RuntimeException $exception) {
            Assert::assertNotFalse(strpos($exception->getMessage(), $message), $exception->getMessage());
        }
    }
}
