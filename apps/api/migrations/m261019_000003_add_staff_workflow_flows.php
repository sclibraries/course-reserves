<?php

use yii\db\Migration;

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
        $this->seedPrintBookFlow();
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

    private function seedPrintBookFlow()
    {
        $materialTypeId = $this->db->createCommand(
            'SELECT material_type_id FROM material_types WHERE name = :name LIMIT 1', [':name' => 'book']
        )->queryScalar();
        if (!$materialTypeId) {
            return;
        }

        $this->insert('flows', [
            'name' => 'Print book',
            'description' => 'Process a physical book for course reserve.',
            'created_by' => 'system',
        ]);
        $flowId = (int)$this->db->getLastInsertID();
        $this->insert('flow_versions', [
            'flow_id' => $flowId,
            'version' => 1,
            'steps_json' => json_encode($this->printBookSteps(), JSON_UNESCAPED_SLASHES),
            'created_by' => 'system',
        ]);
        $this->insert('material_type_flows', [
            'material_type_id' => (int)$materialTypeId,
            'flow_id' => $flowId,
        ]);
    }

    private function printBookSteps()
    {
        return [
            $this->question('own_it', 'Do we own it?', [
                $this->outcome('yes', 'Yes', ['step' => 'available']),
                $this->outcome('no', 'No', ['handoff_group' => 'Acquisitions']),
                $this->outcome('cannot_get', "We can't get this", ['finish' => 'unavailable']),
            ]),
            $this->question('available', 'Is it available?', [
                $this->outcome('available', 'Available', ['step' => 'pull']),
                $this->outcome('checked_out', 'Checked out', ['step' => 'recall']),
                $this->outcome('lost', 'Lost', ['handoff_group' => 'Acquisitions']),
                $this->outcome('cannot_get', "We can't get this", ['finish' => 'unavailable']),
            ]),
            $this->action('recall', 'Recall it', ['step' => 'available']),
            $this->action('pull', 'Pull it from the shelf', ['step' => 'folio_reserve']),
            $this->action('folio_reserve', 'Change its location to on reserve and attach it to the course in FOLIO', ['step' => 'confirm']),
            [
                'key' => 'confirm',
                'kind' => 'confirm_on_reserve',
                'label' => 'Confirm on reserve in FOLIO',
                'help_text' => null,
                'outcomes' => [$this->outcome('done', 'Done', ['finish' => 'on_reserve'])],
            ],
            $this->finish('on_reserve', 'On reserve', 'on_reserve', false),
            $this->finish('unavailable', 'Unavailable', 'unavailable', true),
        ];
    }

    private function question($key, $label, array $outcomes)
    {
        return ['key' => $key, 'kind' => 'question', 'label' => $label, 'help_text' => null, 'outcomes' => $outcomes];
    }

    private function action($key, $label, array $next)
    {
        return [
            'key' => $key,
            'kind' => 'action',
            'label' => $label,
            'help_text' => null,
            'outcomes' => [$this->outcome('done', 'Done', $next)],
        ];
    }

    private function finish($key, $label, $state, $reasonRequired)
    {
        return [
            'key' => $key,
            'kind' => 'finish',
            'label' => $label,
            'help_text' => null,
            'finish_state' => $state,
            'reason_required' => $reasonRequired,
            'outcomes' => [],
        ];
    }

    private function outcome($key, $label, array $next)
    {
        return ['key' => $key, 'label' => $label, 'next' => $next, 'reason_required' => false];
    }
}
