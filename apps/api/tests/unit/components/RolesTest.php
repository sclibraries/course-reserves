<?php

namespace tests\unit\components;

use app\components\Roles;

/**
 * Verifies staff role checks match the shared staff role definition exactly.
 */
class RolesTest extends \Codeception\Test\Unit
{
    public function testIsStaffAcceptsStaffAndAdminRoles()
    {
        $this->assertSame(true, Roles::isStaff('staff'));
        $this->assertSame(true, Roles::isStaff('admin'));
    }

    public function testIsStaffRejectsFacultyAndInvalidRoles()
    {
        foreach ([
            ['faculty', false],
            ['', false],
            [null, false],
            ['Staff', false],
        ] as $case) {
            $this->assertSame($case[1], Roles::isStaff($case[0]));
        }
    }
}
