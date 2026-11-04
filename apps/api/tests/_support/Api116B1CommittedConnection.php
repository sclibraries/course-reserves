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
        // A distinct attribute set gives a separate PDO; the forced transaction Codeception opens on it is ended here.
        $fresh = new \yii\db\Connection([
            'dsn' => $original->dsn,
            'username' => $original->username,
            'password' => $original->password,
            'charset' => $original->charset,
            'attributes' => [\PDO::ATTR_CASE => \PDO::CASE_NATURAL],
        ]);
        $fresh->open();
        self::unwind($fresh);
        \Yii::$app->set('db', $fresh);
        return function () use ($original, $fresh) {
            self::unwind($fresh);
            \Yii::$app->set('db', $original);
            $fresh->close();
        };
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
