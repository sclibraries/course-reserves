<?php

require_once __DIR__ . '/PublicationDestinationConcurrencyWire.php';

/** Drives independent CLI workers with framed, acknowledged phase barriers. */
class PublicationDestinationConcurrencySupervisor
{
    private $timeoutSeconds;
    private $workers = [];
    private $deadline;

    public function __construct($timeoutSeconds = 60)
    {
        $this->timeoutSeconds = (float)$timeoutSeconds;
        $this->deadline = microtime(true) + $this->timeoutSeconds;
    }

    public function start($label, array $request)
    {
        if (!function_exists('proc_open')) {
            throw new \RuntimeException('proc_open is required for API-116B1 concurrency tests.');
        }
        if (isset($this->workers[$label]) && !$this->workers[$label]['closed']) {
            throw new \RuntimeException('Worker label is already active: ' . $label);
        }
        $apiRoot = dirname(__DIR__, 3);
        $workerPath = __DIR__ . '/PublicationDestinationConcurrencyWorker.php';
        $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($workerPath);
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $pipes = [];
        $process = proc_open($command, $descriptors, $pipes, $apiRoot);
        if (!is_resource($process)) {
            throw new \RuntimeException('Could not start concurrency worker: ' . $label);
        }

        foreach ($pipes as $pipe) {
            stream_set_blocking($pipe, false);
        }
        $this->workers[$label] = [
            'process' => $process,
            'pipes' => $pipes,
            'request' => $request,
            'stdout' => '',
            'stderr' => '',
            'events' => [],
            'history' => [],
            'waiting' => null,
            'stdout_eof' => false,
            'closed' => false,
            'exit_code' => null,
        ];

        try {
            $this->writeFrame($label, $request);
        } catch (\Throwable $exception) {
            $this->stopAll();
            throw $exception;
        }
    }

    public function awaitPhase($label, $phase, $attempt = null)
    {
        $frame = $this->next($label);
        if ($frame['phase'] !== $phase
            || ($attempt !== null && (int)$frame['attempt'] !== (int)$attempt)) {
            $this->fail('Expected phase ' . $phase . ' from ' . $label . ', got ' . $frame['phase'] . '.');
        }
        return $frame;
    }

    /** Acknowledges intermediate barriers until the requested phase is pending. */
    public function advanceToPhase($label, $phase)
    {
        while (true) {
            $frame = $this->next($label);
            if ($frame['phase'] === $phase) {
                return $frame;
            }
            if ($frame['phase'] === 'result') {
                $this->fail('Worker returned before expected phase ' . $phase . ': ' . $label);
            }
            $this->release($label, $frame['phase'], $frame['attempt']);
        }
    }

    public function next($label)
    {
        try {
            if (!isset($this->workers[$label])) {
                throw new \RuntimeException('Unknown concurrency worker: ' . $label);
            }
            if ($this->workers[$label]['waiting'] !== null) {
                throw new \RuntimeException('Worker phase was not acknowledged: ' . $label);
            }
            while (true) {
                if ($this->workers[$label]['events']) {
                    $frame = array_shift($this->workers[$label]['events']);
                    if ($frame['phase'] !== 'result') {
                        $this->workers[$label]['waiting'] = $frame;
                    }
                    return $frame;
                }
                if ($this->workers[$label]['closed'] || $this->workers[$label]['stdout_eof']) {
                    throw new \RuntimeException($this->eofMessage($label));
                }
                $this->assertBeforeDeadline();
                $this->pump(0.1);
            }
        } catch (\Throwable $exception) {
            $this->stopAll();
            throw $exception;
        }
    }

    public function release($label, $phase, $attempt = null)
    {
        if (!isset($this->workers[$label]) || $this->workers[$label]['waiting'] === null) {
            $this->fail('No worker phase is waiting for acknowledgement: ' . $label);
        }
        $frame = $this->workers[$label]['waiting'];
        if ($frame['phase'] !== $phase
            || ($attempt !== null && (int)$frame['attempt'] !== (int)$attempt)) {
            $this->fail('Acknowledgement does not match the pending worker phase: ' . $label);
        }
        $this->workers[$label]['waiting'] = null;
        $this->writeFrame($label, [
            'command' => 'go',
            'phase' => $frame['phase'],
            'attempt' => (int)$frame['attempt'],
        ]);
    }

    /** Automatically acknowledges phases until the worker returns its result. */
    public function complete($label)
    {
        while (true) {
            $frame = $this->next($label);
            if ($frame['phase'] === 'result') {
                if (empty($frame['ok'])) {
                    $this->waitForExit($label, false);
                    $this->fail(
                        'Worker operation failed: ' . ($frame['error'] ?? 'unknown error')
                        . $this->stderrSuffix($label),
                        false
                    );
                }
                $this->waitForExit($label);
                if (in_array((int)($frame['mysql_code'] ?? 0), [1205, 1213], true)) {
                    $this->fail('Unexpected operation lock error ' . $frame['mysql_code'] . '.', false);
                }
                return $frame;
            }
            $this->release($label, $frame['phase'], $frame['attempt']);
        }
    }

    public function history($label)
    {
        return $this->workers[$label]['history'] ?? [];
    }

    public function stderr($label)
    {
        return $this->workers[$label]['stderr'] ?? '';
    }

    public function allReaped()
    {
        return !$this->hasActiveWorkers();
    }

    /** Terminates and reaps every still-running worker before fixture cleanup. */
    public function stopAll()
    {
        foreach ($this->workers as $label => $worker) {
            if ($worker['closed']) {
                continue;
            }
            if (is_resource($worker['pipes'][0])) {
                fclose($worker['pipes'][0]);
            }
            @proc_terminate($worker['process'], 15);
        }

        $stopDeadline = microtime(true) + 2.0;
        while ($this->hasActiveWorkers() && microtime(true) < $stopDeadline) {
            try {
                $this->pump(0.05);
            } catch (\Throwable $ignored) {
                // Keep draining/reaping even after a malformed frame caused shutdown.
            }
            foreach ($this->workers as $label => $worker) {
                $this->captureExit($label);
            }
        }

        foreach ($this->workers as $label => $worker) {
            if ($worker['closed']) {
                continue;
            }
            @proc_terminate($worker['process'], 9);
            $this->closeAndReap($label);
        }
    }

    private function pump($waitSeconds)
    {
        $read = [];
        foreach ($this->workers as $worker) {
            if ($worker['closed']) {
                continue;
            }
            if (is_resource($worker['pipes'][1]) && !$worker['stdout_eof']) {
                $read[] = $worker['pipes'][1];
            }
            if (is_resource($worker['pipes'][2])) {
                $read[] = $worker['pipes'][2];
            }
        }
        if (!$read) {
            usleep((int)($waitSeconds * 1000000));
            foreach (array_keys($this->workers) as $label) {
                $this->captureExit($label);
            }
            return;
        }

        $write = null;
        $except = null;
        $seconds = (int)$waitSeconds;
        $microseconds = (int)(($waitSeconds - $seconds) * 1000000);
        $ready = @stream_select($read, $write, $except, $seconds, $microseconds);
        if ($ready === false) {
            return;
        }
        foreach ($read as $stream) {
            foreach ($this->workers as $label => $worker) {
                if ($worker['closed']) {
                    continue;
                }
                if ($stream === $worker['pipes'][1]) {
                    $chunk = fread($stream, 8192);
                    if ($chunk !== false && $chunk !== '') {
                        $this->workers[$label]['stdout'] .= $chunk;
                        $this->parseFrames($label);
                    }
                    if (feof($stream)) {
                        $this->workers[$label]['stdout_eof'] = true;
                        if ($this->workers[$label]['stdout'] !== '') {
                            throw new \RuntimeException('Worker ended with an incomplete JSON frame: ' . $label);
                        }
                    }
                    break;
                }
                if ($stream === $worker['pipes'][2]) {
                    $chunk = fread($stream, 8192);
                    if ($chunk !== false && $chunk !== '') {
                        $this->workers[$label]['stderr'] .= $chunk;
                    }
                    break;
                }
            }
        }
        foreach (array_keys($this->workers) as $label) {
            $this->captureExit($label);
        }
    }

    private function parseFrames($label)
    {
        while (($newline = strpos($this->workers[$label]['stdout'], "\n")) !== false) {
            $line = substr($this->workers[$label]['stdout'], 0, $newline);
            $this->workers[$label]['stdout'] = substr($this->workers[$label]['stdout'], $newline + 1);
            $frame = json_decode($line, true);
            if (!is_array($frame) || json_last_error() !== JSON_ERROR_NONE
                || !isset($frame['op'], $frame['attempt'], $frame['phase'])
                || !is_string($frame['phase']) || !is_numeric($frame['attempt'])) {
                throw new \RuntimeException('Malformed concurrency frame from ' . $label . ': ' . $line);
            }
            if (!in_array($frame['phase'], [
                'ready', 'discovered', 'locked', 'before_insert', 'recovery_entered',
                'before_commit', 'committed', 'result',
            ], true)) {
                throw new \RuntimeException('Unknown concurrency phase from ' . $label . ': ' . $frame['phase']);
            }
            if ($frame['op'] !== ($this->workers[$label]['request']['op'] ?? null)) {
                throw new \RuntimeException('Unexpected operation name in concurrency frame from ' . $label . '.');
            }
            $this->workers[$label]['events'][] = $frame;
            $this->workers[$label]['history'][] = $frame;
        }
    }

    private function writeFrame($label, array $frame)
    {
        $json = json_encode($frame, JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \RuntimeException('Could not encode a concurrency request frame.');
        }
        $data = $json . "\n";
        $offset = 0;
        while ($offset < strlen($data)) {
            $written = fwrite($this->workers[$label]['pipes'][0], substr($data, $offset));
            if ($written === false) {
                throw new \RuntimeException('Could not write a concurrency worker pipe.');
            }
            if ($written === 0) {
                $this->assertBeforeDeadline();
                usleep(1000);
                continue;
            }
            $offset += $written;
        }
        fflush($this->workers[$label]['pipes'][0]);
    }

    private function waitForExit($label, $assertSuccessful = true)
    {
        $exitDeadline = min($this->deadline, microtime(true) + 2.0);
        while (!$this->workers[$label]['closed'] && microtime(true) < $exitDeadline) {
            $this->pump(0.05);
        }
        if (!$this->workers[$label]['closed']) {
            $this->fail('Worker returned a result but did not exit: ' . $label);
        }
        if ($this->workers[$label]['events'] || $this->workers[$label]['stdout'] !== '') {
            $this->fail('Worker emitted frames after its result: ' . $label);
        }
        if ($assertSuccessful && $this->workers[$label]['exit_code'] !== 0) {
            $this->fail('Worker exited with code ' . $this->workers[$label]['exit_code'] . ': ' . $label
                . $this->stderrSuffix($label), false);
        }
    }

    private function captureExit($label)
    {
        if (!isset($this->workers[$label]) || $this->workers[$label]['closed']) {
            return;
        }
        $status = proc_get_status($this->workers[$label]['process']);
        if (!$status['running']) {
            $this->workers[$label]['exit_code'] = (int)$status['exitcode'];
            $this->closeAndReap($label);
        }
    }

    private function closeAndReap($label)
    {
        $worker = $this->workers[$label];
        foreach ($worker['pipes'] as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }
        $closedCode = proc_close($worker['process']);
        if ($this->workers[$label]['exit_code'] === null || $this->workers[$label]['exit_code'] === -1) {
            $this->workers[$label]['exit_code'] = (int)$closedCode;
        }
        $this->workers[$label]['closed'] = true;
    }

    private function hasActiveWorkers()
    {
        foreach ($this->workers as $worker) {
            if (!$worker['closed']) {
                return true;
            }
        }
        return false;
    }

    private function assertBeforeDeadline()
    {
        if ($this->deadline !== null && microtime(true) >= $this->deadline) {
            throw new \RuntimeException('Concurrency worker deadline exceeded (' . $this->timeoutSeconds . ' seconds).');
        }
    }

    private function eofMessage($label)
    {
        return 'Concurrency worker reached EOF before the expected phase: ' . $label
            . $this->stderrSuffix($label);
    }

    private function stderrSuffix($label)
    {
        return $this->workers[$label]['stderr'] !== ''
            ? "\nWorker stderr:\n" . $this->workers[$label]['stderr'] : '';
    }

    private function fail($message, $stop = true)
    {
        if ($stop) {
            $this->stopAll();
        }
        throw new \RuntimeException($message);
    }
}
