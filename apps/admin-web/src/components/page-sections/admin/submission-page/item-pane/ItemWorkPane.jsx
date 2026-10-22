import { useState } from 'react';
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

const itemTabClass = 'tw-min-w-0 tw-whitespace-normal tw-break-words tw-px-1 tw-text-center tw-text-xs tw-leading-tight sm:tw-whitespace-nowrap sm:tw-px-3 sm:tw-text-sm';

function ItemWorkPane({ item, submission, currentUsername = '', onChanged, onGoToWork, onReopen }) {
  const [activeTab, setActiveTab] = useState('process');
  const claims = useItemClaimActions({ item, currentUsername, onChanged });
  const flow = useItemFlow({ item, onChanged });
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
      <Tabs value={activeTab} onValueChange={handleTabChange} className="tw-min-w-0">
        <TabsList className="tw-grid tw-h-auto tw-w-full tw-grid-cols-2 sm:tw-grid-cols-4">
          <TabsTrigger value="process" className={itemTabClass}>Process</TabsTrigger>
          <TabsTrigger value="messages" className={itemTabClass}>Messages ({unreadCount} unread)</TabsTrigger>
          <TabsTrigger value="details" className={itemTabClass}>Details</TabsTrigger>
          <TabsTrigger value="history" className={itemTabClass}>History</TabsTrigger>
        </TabsList>
        <TabsContent value="process" className="tw-min-w-0">
          <ProcessTab
            item={item}
            currentUsername={currentUsername}
            flow={flow}
            switchFlow={switchFlow}
            onGoToWork={onGoToWork}
            onReopen={onReopen}
          />
        </TabsContent>
        <TabsContent value="messages" className="tw-min-w-0">
          <MessagesTab item={item} submission={submission} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="details" className="tw-min-w-0">
          <DetailsTab item={item} />
        </TabsContent>
        <TabsContent value="history" className="tw-min-w-0">
          <HistoryTab
            flowHistory={flow.flowState?.history || []}
            timeline={{ ...timeline, title: item.title, kind: item.kind, itemId: item.id }}
          />
        </TabsContent>
      </Tabs>
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
