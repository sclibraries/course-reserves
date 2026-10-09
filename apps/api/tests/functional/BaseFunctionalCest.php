<?php
/**
 * BaseFunctionalCest.php
 *
 * Shared setup for all functional Cest classes that need to reach the Docker
 * MySQL database.  The default Codeception test config points at
 * yii2basic_test (which does not exist inside the backend container), so every
 * Cest that hits the DB must override the connection before running.
 *
 * Usage:
 *   class MyCest extends BaseFunctionalCest { ... }
 *   // Call parent::_before($I) first if you need to add more setup.
 */
class BaseFunctionalCest
{
    /**
     * Override the Yii2 DB component to use the Docker 'reserves' database
     * and disable the index.php URL prefix for clean route assertions.
     */
    public function _before(FunctionalTester $I)
    {
        \Yii::$app->set('db', new \yii\db\Connection([
            'dsn'      => sprintf(
                'mysql:host=%s;dbname=%s',
                getenv('DB_HOST') ?: 'db',
                getenv('DB_NAME') ?: 'reserves'
            ),
            'username' => getenv('DB_USER') ?: 'folio-reserves',
            'password' => getenv('DB_PASS') ?: 'folio-reserves',
            'charset'  => 'utf8',
        ]));

        \Yii::$app->urlManager->showScriptName = false;
    }
}
