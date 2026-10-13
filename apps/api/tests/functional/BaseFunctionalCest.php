<?php
/**
 * BaseFunctionalCest.php
 *
 * Shared setup for all functional Cest classes.
 * The test DB connection is configured by config/test_db.php.
 *
 * Usage:
 *   class MyCest extends BaseFunctionalCest { ... }
 *   // Call parent::_before($I) first if you need to add more setup.
 */
class BaseFunctionalCest
{
    /**
     * Disable the index.php URL prefix for clean route assertions.
     */
    public function _before(FunctionalTester $I)
    {
        \Yii::$app->urlManager->showScriptName = false;
    }
}
