<?php

/**
 * Swaps Yii::$app->db for a connection outside Codeception's per-test transaction, so registry transactions are
 * truly outermost (level 0) and their commits and rollbacks are real. Callers clean up what they commit.
 */
class Api116B1CommittedConnection
{
    public static function swap()
    {
        $original = \Yii::$app->db;
        $fresh = self::open($original, [\PDO::ATTR_CASE => \PDO::CASE_NATURAL]);
        \Yii::$app->set('db', $fresh);
        return function () use ($original, $fresh) {
            self::unwind($fresh);
            \Yii::$app->set('db', $original);
            $fresh->close();
        };
    }

    /**
     * A distinct attribute set gives a separate PDO (Codeception caches one PDO per attribute set and hands it back on
     * reopen); the forced transaction Codeception opens on it is ended here.
     */
    public static function open($like, array $attributes)
    {
        $connection = new \yii\db\Connection([
            'dsn' => $like->dsn,
            'username' => $like->username,
            'password' => $like->password,
            'charset' => $like->charset,
            'attributes' => $attributes,
        ]);
        $connection->open();
        self::unwind($connection);
        return $connection;
    }

    /**
     * A connection Codeception's transaction forcer never sees: an instance handler marks EVENT_AFTER_OPEN handled,
     * so the class-level forcer neither wraps it in a transaction nor caches its PDO. Reopening the same object
     * therefore really connects anew, which lets a test prove recovery after the connection was closed.
     */
    public static function unforced($like)
    {
        $connection = new \yii\db\Connection([
            'dsn' => $like->dsn,
            'username' => $like->username,
            'password' => $like->password,
            'charset' => $like->charset,
        ]);
        $connection->on(\yii\db\Connection::EVENT_AFTER_OPEN, function ($event) {
            $event->handled = true;
        });
        return $connection;
    }

    public static function level()
    {
        $transaction = \Yii::$app->db->getTransaction();
        return $transaction !== null && $transaction->isActive ? $transaction->level : 0;
    }

    private static function unwind($db)
    {
        while ($db->getTransaction() !== null && $db->getTransaction()->isActive) {
            $db->getTransaction()->rollBack();
        }
    }
}
