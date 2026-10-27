<?php

namespace app\models;

/** One staff member's saved navigation pins. */
class StaffNavPin extends NavPinRecord
{
    public static function tableName()
    {
        return 'staff_nav_pins';
    }
}
