<?php

use yii\db\Migration;
use app\services\PrintBookFlowMapping;

class m261019_000003_add_staff_workflow_flows extends Migration
{
    public function safeUp()
    {
        $this->createTable('flows', [
            'id' => $this->primaryKey()->unsigned(),
            'name' => $this->string(255)->notNull(),
            'description' => $this->text()->null(),
            'created_by' => $this->string(255)->notNull(),
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
        ]);
        $this->createIndex('uq_flows_name', 'flows', 'name', true);

        $this->createTable('flow_versions', [
            'flow_id' => $this->integer()->unsigned()->notNull(),
            'version' => $this->integer()->unsigned()->notNull(),
            'steps_json' => 'LONGTEXT NOT NULL',
            'created_by' => $this->string(255)->notNull(),
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
            'PRIMARY KEY(flow_id, version)',
        ]);
        $this->addForeignKey(
            'fk_staff_flow_versions_flow', 'flow_versions', 'flow_id', 'flows', 'id', 'CASCADE'
        );

        $this->createTable('material_type_flows', [
            'material_type_id' => $this->integer()->notNull(),
            'flow_id' => $this->integer()->unsigned()->null(),
            'PRIMARY KEY(material_type_id)',
        ]);
        $this->addForeignKey(
            'fk_material_type_flows_type', 'material_type_flows', 'material_type_id', 'material_types', 'material_type_id', 'CASCADE'
        );
        $this->addForeignKey(
            'fk_material_type_flows_flow', 'material_type_flows', 'flow_id', 'flows', 'id', 'SET NULL'
        );

        $this->createTable('item_flow_runs', [
            'id' => $this->bigPrimaryKey()->unsigned(),
            'item_kind' => $this->string(16)->notNull(),
            'item_id' => $this->bigInteger()->unsigned()->notNull(),
            'flow_id' => $this->integer()->unsigned()->notNull(),
            'version' => $this->integer()->unsigned()->notNull(),
            'current_step_key' => $this->string(128)->null(),
            'finish_state' => $this->string(32)->null(),
            'finish_reason' => $this->text()->null(),
            'started_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
            'closed_at' => $this->timestamp()->null(),
            'closed_reason' => $this->text()->null(),
        ]);
        $this->createIndex('idx_item_flow_runs_item', 'item_flow_runs', ['item_kind', 'item_id', 'started_at']);
        $this->createIndex('idx_item_flow_runs_flow', 'item_flow_runs', ['flow_id', 'version']);
        $this->addForeignKey(
            'fk_item_flow_runs_version', 'item_flow_runs', ['flow_id', 'version'],
            'flow_versions', ['flow_id', 'version'], 'RESTRICT'
        );

        $this->createTable('item_flow_step_results', [
            'id' => $this->bigPrimaryKey()->unsigned(),
            'run_id' => $this->bigInteger()->unsigned()->notNull(),
            'step_key' => $this->string(128)->notNull(),
            'outcome_key' => $this->string(128)->notNull(),
            'notes' => $this->text()->null(),
            'reason' => $this->text()->null(),
            'actor_username' => $this->string(255)->notNull(),
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
        ]);
        $this->createIndex('idx_item_flow_step_results_run', 'item_flow_step_results', ['run_id', 'id']);
        $this->addForeignKey(
            'fk_item_flow_step_results_run', 'item_flow_step_results', 'run_id', 'item_flow_runs', 'id', 'CASCADE'
        );

        $this->alterColumn('workflow_events', 'submission_id', $this->bigInteger()->unsigned()->null());
        (new PrintBookFlowMapping($this->db))->findOrCreate();
    }

    public function safeDown()
    {
        $this->delete('workflow_events', ['submission_id' => null]);
        $this->dropForeignKey('fk_item_flow_step_results_run', 'item_flow_step_results');
        $this->dropTable('item_flow_step_results');
        $this->dropForeignKey('fk_item_flow_runs_version', 'item_flow_runs');
        $this->dropTable('item_flow_runs');
        $this->dropTable('material_type_flows');
        $this->dropTable('flow_versions');
        $this->dropTable('flows');
        $this->alterColumn('workflow_events', 'submission_id', $this->bigInteger()->unsigned()->notNull());
    }

}
