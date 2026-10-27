<?php

namespace app\models;

/** Institution-wide default navigation pins. */
class StaffNavPinDefault extends NavPinRecord
{
    public static function tableName()
    {
        return 'staff_nav_pin_defaults';
    }
}
