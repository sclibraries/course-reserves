<?php

namespace tests\unit\services;

use app\services\ApprovedUserLookup;
use app\services\FacultyRoleResolver;

class FacultyRoleResolverTest extends \Codeception\Test\Unit
{
    public function testApprovedLibraryRolesTakePrecedenceOverAffiliation()
    {
        $resolver = $this->resolver([
            'test-api069-staff' => ['username' => 'test-api069-staff', 'approved' => 1, 'role' => 'staff'],
            'test-api069-admin' => ['username' => 'test-api069-admin', 'approved' => 1, 'role' => 'admin'],
        ]);

        $this->assertSame('staff', $resolver->forFacultyAuthorization('test-api069-staff', 'faculty employee'));
        $this->assertSame('admin', $resolver->forFacultyAuthorization('test-api069-admin', 'employee'));
    }

    public function testUnapprovedUserRowCannotGrantStaffRole()
    {
        $resolver = $this->resolver([
            'test-api069-unapproved' => ['username' => 'test-api069-unapproved', 'approved' => 0, 'role' => 'staff'],
        ]);

        $this->assertSame('employee', $resolver->forFacultyAuthorization('test-api069-unapproved', 'staff'));
    }

    public function testFacultyAffiliationGetsFacultyRole()
    {
        $resolver = $this->resolver([]);

        $this->assertSame('faculty', $resolver->forFacultyAuthorization('test-api069-faculty', 'Faculty'));
    }

    public function testNonFacultyEmployeesWithoutApprovedAccountGetEmployeeRole()
    {
        $resolver = $this->resolver([]);

        $this->assertSame('employee', $resolver->forFacultyAuthorization('test-api069-staff', 'staff'));
        $this->assertSame('employee', $resolver->forFacultyAuthorization('test-api069-employee', 'employee'));
    }

    public function testRefreshRevalidatesLibraryRolesAndDowngradesUnknownStaffClaims()
    {
        $resolver = $this->resolver([
            'test-api069-staff' => ['username' => 'test-api069-staff', 'approved' => 1, 'role' => 'staff'],
            'test-api069-admin' => ['username' => 'test-api069-admin', 'approved' => 1, 'role' => 'admin'],
        ]);

        $this->assertSame('staff', $resolver->forRefresh('test-api069-staff', 'staff'));
        $this->assertSame('admin', $resolver->forRefresh('test-api069-admin', 'staff'));
        $this->assertSame('employee', $resolver->forRefresh('test-api069-no-account', 'staff'));
        $this->assertSame('faculty', $resolver->forRefresh('test-api069-faculty', 'faculty'));
    }

    private function resolver(array $users)
    {
        $lookup = new ApprovedUserLookup(function ($username) use ($users) {
            return isset($users[$username]) ? $users[$username] : false;
        });

        return new FacultyRoleResolver($lookup);
    }
}
