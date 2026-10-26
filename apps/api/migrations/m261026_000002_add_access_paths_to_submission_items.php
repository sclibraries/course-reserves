<?php

use yii\db\Migration;

class m261026_000002_add_access_paths_to_submission_items extends Migration
{
    public function safeUp()
    {
        $this->addColumn('submission_new_resources', 'access_path', $this->string(32)->null());
        $this->addColumn('submission_reuse_resources', 'access_path', $this->string(32)->null());
        $this->createTable('access_path_flows', [
            'access_path' => $this->string(32)->notNull(),
            'flow_id' => $this->integer()->unsigned()->null(),
            'group_id' => $this->integer()->unsigned()->null(),
            'PRIMARY KEY(access_path)',
        ]);
        $this->addForeignKey('fk_access_path_flows_flow', 'access_path_flows', 'flow_id', 'flows', 'id', 'SET NULL');
        $this->addForeignKey(
            'fk_access_path_flows_group', 'access_path_flows', 'group_id', 'staff_groups', 'id', 'SET NULL'
        );
    }

    public function safeDown()
    {
        $this->dropForeignKey('fk_access_path_flows_group', 'access_path_flows');
        $this->dropForeignKey('fk_access_path_flows_flow', 'access_path_flows');
        $this->dropTable('access_path_flows');
        $this->dropColumn('submission_reuse_resources', 'access_path');
        $this->dropColumn('submission_new_resources', 'access_path');
    }
}
