'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import DateSeparator, { getDateSeparatorText } from './DateSeparator';

// Group messages by sender and time proximity (< 1 minute apart)
function groupMessages(messages) {
  if (!messages || messages.length === 0) return [];

  const groups = [];
  let currentGroup = [];

  messages.forEach((msg, idx) => {
    const prevMsg = idx > 0 ? messages[idx - 1] : null;

    // Check if should start new group
    const shouldStartNewGroup =
      !prevMsg ||
      prevMsg.from_me !== msg.from_me ||
      (msg.timestamp - prevMsg.timestamp) > 60000; // > 1 minute

    if (shouldStartNewGroup && currentGroup.length > 0) {
      groups.push([...currentGroup]);
      currentGroup = [];
    }

    currentGroup.push(msg);
  });

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

// Scroll to bottom button component
function ScrollToBottomButton({ onClick, newMessageCount = 0, visible }) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all border border-gray-200 z-10"
      title="Aller en bas"
    >
      {newMessageCount > 0 && (
        <span className="absolute -top-2 -right-1 bg-[#25d366] text-white text-xs font-medium min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
          {newMessageCount}
        </span>
      )}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </button>
  );
}

export default function MessageList({
  messages = [],
  contactName = 'Contact',
  onPreviewDoc,
  onLoadMore,
  hasMoreMessages = false,
  isLoadingMore = false
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const lastMessageCountRef = useRef(messages.length);
  const isUserAtBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  // Scroll to bottom function
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior });
      setNewMessageCount(0);
      setShowScrollButton(false);
    }
  }, []);

  // Check if user is at bottom
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const threshold = 100; // px from bottom
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    isUserAtBottomRef.current = isAtBottom;
    return isAtBottom;
  }, []);

  // Handle scroll event
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom = checkIfAtBottom();
    setShowScrollButton(!isAtBottom);

    if (isAtBottom) {
      setNewMessageCount(0);
    }

    // Load more when scrolled to top
    if (container.scrollTop < 100 && hasMoreMessages && !isLoadingMore && onLoadMore) {
      const prevScrollHeight = container.scrollHeight;
      onLoadMore().then(() => {
        // Preserve scroll position after loading more
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        });
      });
    }
  }, [checkIfAtBottom, hasMoreMessages, isLoadingMore, onLoadMore]);

  // Initial scroll to bottom when messages first load
  useEffect(() => {
    if (messages.length > 0 && !initialScrollDoneRef.current) {
      // Use instant scroll for initial load
      requestAnimationFrame(() => {
        scrollToBottom('instant');
        initialScrollDoneRef.current = true;
      });
    }
  }, [messages.length, scrollToBottom]);

  // Reset initial scroll flag when conversation changes
  useEffect(() => {
    initialScrollDoneRef.current = false;
    setNewMessageCount(0);
    setShowScrollButton(false);
    lastMessageCountRef.current = 0;
  }, [contactName]); // contactName changes when conversation changes

  // Handle new messages arriving
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = lastMessageCountRef.current;

    if (currentCount > prevCount && initialScrollDoneRef.current) {
      const newMessages = currentCount - prevCount;

      if (isUserAtBottomRef.current) {
        // User is at bottom - auto scroll
        requestAnimationFrame(() => {
          scrollToBottom('smooth');
        });
      } else {
        // User is not at bottom - show badge
        setNewMessageCount(prev => prev + newMessages);
        setShowScrollButton(true);
      }
    }

    lastMessageCountRef.current = currentCount;
  }, [messages.length, scrollToBottom]);

  // Group messages for rendering
  const messageGroups = groupMessages(messages);

  // Render messages with date separators
  const renderMessages = () => {
    const elements = [];
    let lastDate = null;

    messageGroups.forEach((group, groupIdx) => {
      group.forEach((msg, msgIdx) => {
        // Check if we need a date separator
        const currentDate = getDateSeparatorText(msg.timestamp);
        if (currentDate !== lastDate) {
          elements.push(
            <DateSeparator key={`date-${msg.id}`} date={currentDate} />
          );
          lastDate = currentDate;
        }

        // Render message bubble
        const isFirstInGroup = msgIdx === 0;
        const isLastInGroup = msgIdx === group.length - 1;

        elements.push(
          <MessageBubble
            key={msg.id}
            message={msg}
            showSenderName={!msg.from_me}
            senderName={msg.sender_name}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            contactName={contactName}
            onPreviewDoc={onPreviewDoc}
          />
        );
      });
    });

    return elements;
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Loading indicator for older messages */}
      {isLoadingMore && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-white/90 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-gray-500">Chargement...</span>
        </div>
      )}

      {/* Messages container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-[5%] py-2 scroll-smooth"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAABNVBMVEUAAADd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dXd2dUkFrYCAAAAZnRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl9gYWJjZGUG8s8TAAAB7ElEQVRIx8XW11LCQBSA4ZNGCRAIvfeOIqigYu+9d+ztvef9H8BkYZcYE3fG8b/Z2fnm7MzuBIL/Qpy/p8LBhSNO1eDy4f1+KuU/QjJdX2wHMkeFjJOlXC5TdpjyJYeJpT+cHCz4kv/gEJ0nXB7kfMnl4TKd1wcp1we5EiTXIxAv+IKXvJ/4TFu7u1LxBa/5eOJzbePuquQF33I48nJjy9a2a15v/x1X7Qjvpk8i0+tEKCf1XMGLLB2cjpNl4p3k8mCc8AXPczVAcXQ08P++cxQvkIyDxQE0nfICMYQLBgheE8KLA0jNETz3DG+IDoLBZxPM9wfwGiG8P4hPL/cHiOwhPDvIn16+P0TsCiHqET6b4vMD+B0hRDzExybqIwc7Q4g4hM9M18VLBsZ2hRBuhPCCxOyE5MjBjhDC3QifjfPZ+bGDBw+FEPYIH52k8wluvH/w4KEQwn4IH5mgi0sGhvYcPHwkhLALwkcnJRfH+4sHdu87eOhoCGFnCB+aoEtLBocO7Osd3L3v4OHjIYQdIXxwki4nxOi+3gMH9+0+dPjwiRDCPggfmJicGBy7f2C/s/PAvoOHjp46FULYFcL7xkdGB+/r6+8/cODgoUOHjp4+E0LYBeG9o8PDd/f29R/Y33/g8Ilz50OIPxHyH9tFTu8PAAAAAElFTkSuQmCC")`,
          backgroundRepeat: 'repeat'
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">Aucun message</p>
            </div>
          </div>
        ) : (
          <>
            {renderMessages()}
            <div ref={bottomRef} className="h-1" />
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      <ScrollToBottomButton
        onClick={() => scrollToBottom('smooth')}
        newMessageCount={newMessageCount}
        visible={showScrollButton}
      />
    </div>
  );
}

export { groupMessages, ScrollToBottomButton };
