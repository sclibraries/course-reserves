<?php

/** Delegates SQL to Yii's command and records the real executed statement. */
class PublicationDestinationConcurrencyCommand extends \yii\db\Command
{
    private static $queries = [];

    public static function resetQueries()
    {
        self::$queries = [];
    }

    public static function queries()
    {
        return self::$queries;
    }

    public function execute()
    {
        try {
            return parent::execute();
        } finally {
            self::$queries[] = $this->getRawSql();
        }
    }

    protected function queryInternal($method, $fetchMode = null)
    {
        try {
            return parent::queryInternal($method, $fetchMode);
        } finally {
            self::$queries[] = $this->getRawSql();
        }
    }
}
