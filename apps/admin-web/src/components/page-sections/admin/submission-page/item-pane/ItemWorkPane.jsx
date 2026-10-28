import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import useItemClaimActions from '../../../../../hooks/admin/useItemClaimActions';
import useItemFlow from '../../../../../hooks/admin/useItemFlow';
import useItemTimeline from '../../../../../hooks/admin/useItemTimeline';
import useSwitchFlow from '../../../../../hooks/admin/useSwitchFlow';
import HandoffDialog from './HandoffDialog';
import ItemPaneHeader from './ItemPaneHeader';
import ProcessTab from './ProcessTab';
import MessagesTab from './MessagesTab';
import DetailsTab from './DetailsTab';
import HistoryTab from './HistoryTab';
import TakeoverDialog from './TakeoverDialog';

const itemTabClass = 'tw-min-w-0 tw-whitespace-normal tw-break-words tw-rounded-none tw-border-b-2 tw-border-transparent tw-bg-transparent tw-px-2 tw-py-2 tw-text-center tw-text-xs tw-leading-tight tw-shadow-none data-[state=active]:tw-border-primary data-[state=active]:tw-bg-transparent data-[state=active]:tw-text-foreground data-[state=active]:tw-shadow-none sm:tw-text-sm';

function ItemWorkPane({ item, submission, currentUsername = '', onChanged, onGoToWork, onReopen }) {
  const [activeTab, setActiveTab] = useState('process');
  const flow = useItemFlow({ item, onChanged });
  const loadFlow = flow.loadFlow;
  const reloadAfterClaimChange = useCallback(async () => {
    await onChanged?.();
    await loadFlow();
  }, [loadFlow, onChanged]);
  const claims = useItemClaimActions({ item, currentUsername, onChanged: reloadAfterClaimChange });
  const switchFlow = useSwitchFlow({
    item,
    canAct: Boolean(flow.flowState?.can_act),
    onFlowStateChange: flow.replaceFlowState,
    onChanged,
    clearItemError: flow.clearError,
  });
  const timeline = useItemTimeline(item);
  const handleTabChange = (value) => {
    setActiveTab(value);
    if (value === 'history') timeline.load();
  };
  const unreadCount = item.unreadCommunications || 0;

  return (
    <section aria-label={`Item work pane: ${item.title}`} className="tw-min-w-0 tw-space-y-4">
      <ItemPaneHeader item={item} currentUsername={currentUsername} claims={claims} />
      <HandoffDialog claims={claims} title={item.title || 'item'} />
      <TakeoverDialog claims={claims} title={item.title || 'item'} />
      <section aria-label="Item processing" className="tw-min-w-0 tw-rounded-lg tw-border tw-bg-card tw-p-3 sm:tw-p-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="tw-min-w-0">
          <TabsList aria-label="Item sections" className="tw-grid tw-h-auto tw-w-full tw-grid-cols-2 tw-justify-start tw-gap-x-3 tw-rounded-none tw-border-b tw-bg-transparent tw-p-0 lg:tw-flex">
            <TabsTrigger value="process" className={itemTabClass}>Process</TabsTrigger>
            <TabsTrigger value="messages" className={itemTabClass}>Messages ({unreadCount} unread)</TabsTrigger>
            <TabsTrigger value="details" className={itemTabClass}>Details</TabsTrigger>
            <TabsTrigger value="history" className={itemTabClass}>History</TabsTrigger>
          </TabsList>
          <TabsContent value="process" className="tw-min-w-0 tw-mt-4">
            <ProcessTab
              item={item}
              claims={claims}
              flow={flow}
              switchFlow={switchFlow}
              onGoToWork={onGoToWork}
              onReopen={onReopen}
              onChanged={onChanged}
            />
          </TabsContent>
          <TabsContent value="messages" className="tw-min-w-0 tw-mt-4">
            <MessagesTab item={item} submission={submission} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="details" className="tw-min-w-0 tw-mt-4">
            <DetailsTab item={item} />
          </TabsContent>
          <TabsContent value="history" className="tw-min-w-0 tw-mt-4">
            <HistoryTab
              flowHistory={flow.flowState?.history || []}
              timeline={{ ...timeline, title: item.title, kind: item.kind, itemId: item.id }}
            />
          </TabsContent>
        </Tabs>
      </section>
    </section>
  );
}

ItemWorkPane.propTypes = {
  item: PropTypes.object.isRequired,
  submission: PropTypes.object,
  currentUsername: PropTypes.string,
  onChanged: PropTypes.func,
  onGoToWork: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
};

export default ItemWorkPane;
