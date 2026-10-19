<?php

use yii\db\Migration;

class m261019_000002_add_staff_groups extends Migration
{
    public function safeUp()
    {
        $this->createTable('staff_groups', [
            'id' => $this->primaryKey()->unsigned(),
            'name' => $this->string(255)->notNull(),
            'description' => $this->text()->null(),
            'created_by' => $this->string(255)->notNull(),
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
        ]);
        $this->createIndex('uq_staff_groups_name', 'staff_groups', 'name', true);

        $this->createTable('staff_group_members', [
            'group_id' => $this->integer()->unsigned()->notNull(),
            'username' => $this->string(255)->notNull(),
            'added_by' => $this->string(255)->notNull(),
            'added_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
            'PRIMARY KEY(group_id, username)',
        ]);
        $this->createIndex('idx_staff_group_members_username', 'staff_group_members', 'username');
        $this->addForeignKey(
            'fk_staff_group_members_group', 'staff_group_members', 'group_id', 'staff_groups', 'id', 'CASCADE'
        );

        $this->createTable('staff_group_events', [
            'id' => $this->primaryKey(),
            'group_id' => $this->integer()->unsigned()->null(),
            'group_name' => $this->string(255)->notNull(),
            'actor_username' => $this->string(255)->notNull(),
            'actor_role' => $this->string(32)->notNull(),
            'event_type' => $this->string(64)->notNull(),
            'before_json' => $this->json()->null(),
            'after_json' => $this->json()->null(),
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
        ]);
        $this->createIndex('idx_staff_group_events_group', 'staff_group_events', ['group_id', 'created_at']);

        $this->createIndex('idx_new_assigned_group', 'submission_new_resources', 'assigned_group_id');
        $this->createIndex('idx_reuse_assigned_group', 'submission_reuse_resources', 'assigned_group_id');
        $this->addForeignKey(
            'fk_new_assigned_group', 'submission_new_resources', 'assigned_group_id', 'staff_groups', 'id'
        );
        $this->addForeignKey(
            'fk_reuse_assigned_group', 'submission_reuse_resources', 'assigned_group_id', 'staff_groups', 'id'
        );
    }

    public function safeDown()
    {
        $this->dropForeignKey('fk_reuse_assigned_group', 'submission_reuse_resources');
        $this->dropForeignKey('fk_new_assigned_group', 'submission_new_resources');
        $this->dropIndex('idx_reuse_assigned_group', 'submission_reuse_resources');
        $this->dropIndex('idx_new_assigned_group', 'submission_new_resources');
        $this->dropTable('staff_group_events');
        $this->dropForeignKey('fk_staff_group_members_group', 'staff_group_members');
        $this->dropTable('staff_group_members');
        $this->dropTable('staff_groups');
    }
}
