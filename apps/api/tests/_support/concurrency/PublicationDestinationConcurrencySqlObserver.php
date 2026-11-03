<?php

require_once __DIR__ . '/PublicationDestinationConcurrencyCommand.php';

/** Observes successfully executed SQL after Yii has delegated to the real connection. */
class PublicationDestinationConcurrencySqlObserver
{
    private $queries = [];
    private $originalCommandClass;

    public function attach($db)
    {
        $this->originalCommandClass = $db->commandClass;
        $db->commandClass = PublicationDestinationConcurrencyCommand::class;
        PublicationDestinationConcurrencyCommand::resetQueries();
    }

    public function detach($db)
    {
        if ($this->originalCommandClass !== null) {
            $db->commandClass = $this->originalCommandClass;
            $this->originalCommandClass = null;
        }
    }

    public function reset()
    {
        PublicationDestinationConcurrencyCommand::resetQueries();
    }

    public function queries()
    {
        $this->queries = PublicationDestinationConcurrencyCommand::queries();
        return $this->queries;
    }
}
