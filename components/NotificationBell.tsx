import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Page } from '../types';
import { BellIcon } from './icons/Icons';
import './NotificationBell.css';

interface NotificationBellProps {
  conversations: Conversation[];
  setActivePage: (page: Page) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ conversations, setActivePage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const unreadConversations = conversations.filter(c => c.unreadCount > 0);
  const hasUnread = unreadConversations.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNotificationClick = () => {
    // In a real app, you might also want to mark the message as read here
    // and navigate to the specific conversation.
    setActivePage('Messages');
    setIsOpen(false);
  };

  return (
    <div className="notification-bell-container" ref={popupRef}>
      <button className="notification-bell" onClick={() => setIsOpen(prev => !prev)} aria-label={`Notifications ${hasUnread ? '(New messages)' : ''}`}>
        <BellIcon />
        {hasUnread && <div className="notification-bell__badge"></div>}
      </button>

      {isOpen && (
        <div className="notification-popup">
          <div className="notification-popup__header">
            <h3>Notifications</h3>
          </div>
          <div className="notification-popup__content">
            {unreadConversations.length > 0 ? (
              <ul className="notification-list">
                {unreadConversations.map(convo => {
                  const lastMessage = convo.messages[convo.messages.length - 1];
                  return (
                    <li key={convo.id} className="notification-item" onClick={handleNotificationClick}>
                      <img src={convo.property.host.avatarUrl} alt={convo.property.host.name} className="notification-item__avatar" />
                      <div className="notification-item__details">
                        <p className="notification-item__text">
                          New message from <strong>{convo.property.host.name}</strong>
                        </p>
                        <p className="notification-item__subtext">
                          Regarding: {convo.property.title}
                        </p>
                        <p className="notification-item__message-preview">
                          "{lastMessage.text}"
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="notification-popup__empty-state">No new notifications</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
