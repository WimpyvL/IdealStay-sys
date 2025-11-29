
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MessageIcon, BuildingOfficeIcon, UserGroupIcon } from '../components/icons/Icons';
import './MessagesPage.css';
import { getConversations, getArchivedConversations, getMessages, sendMessage, markConversationRead, archiveConversation, unarchiveConversation, ConversationSummary, MessageItem } from '../src/services/messages.service';
import { useChatSocket } from '../src/hooks/useChatSocket';
import { useAuth } from '../src/contexts/AuthContext';
import Avatar from '../components/Avatar';
import { toAbsoluteImageUrl } from '../components/imageUtils';

interface LoadingState {
  conversations: boolean;
  messages: boolean;
  sending: boolean;
  archiving: boolean;
}

interface UserProfilePopup {
  visible: boolean;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    profile_image?: string;
  } | null;
  position: { x: number; y: number };
}

const MessagesPage: React.FC = () => {
  const { state } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState<LoadingState>({ conversations: false, messages: false, sending: false, archiving: false });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profilePopup, setProfilePopup] = useState<UserProfilePopup>({ visible: false, user: null, position: { x: 0, y: 0 } });
  const [archivedConversations, setArchivedConversations] = useState<ConversationSummary[]>([]);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [restoringConversationId, setRestoringConversationId] = useState<number | null>(null);
  const [archivedPrefetched, setArchivedPrefetched] = useState(false);

  const loadArchivedConversations = useCallback(async () => {
    setArchivedLoading(true);
    setArchivedError(null);
    setArchivedPrefetched(true);
    try {
      const data = await getArchivedConversations();
      setArchivedConversations(data);
    } catch (e) {
      setArchivedError('Failed to load archived conversations');
    } finally {
      setArchivedLoading(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setLoading(l => ({ ...l, conversations: true }));
    setError(null);
    try {
      const data = await getConversations();
      setConversations(data);
      if (data.length && !activeConversationId) {
        setActiveConversationId(data[0].id);
      }
      if (!data.length && !archivedPrefetched) {
        loadArchivedConversations();
      }
    } catch (e) {
      setError('Failed to load conversations');
    } finally {
      setLoading(l => ({ ...l, conversations: false }));
    }
  }, [activeConversationId, archivedPrefetched, loadArchivedConversations]);

  const handleUnarchiveConversation = useCallback(async (conversationId: number) => {
    setRestoringConversationId(conversationId);
    setArchivedError(null);
    try {
      await unarchiveConversation(conversationId);
      setNotice('Conversation restored');
      setArchivedConversations(prev => prev.filter(conv => conv.id !== conversationId));
      await loadConversations();
      if (!showArchivedModal) {
        loadArchivedConversations();
      }
    } catch (e) {
      setArchivedError('Failed to restore conversation');
    } finally {
      setRestoringConversationId(null);
    }
  }, [loadConversations, loadArchivedConversations, showArchivedModal]);

  const loadMessages = useCallback(async (conversationId: number) => {
    setLoading(l => ({ ...l, messages: true }));
    setError(null);
    try {
      const msgs = await getMessages(conversationId);
      setMessages(msgs);
      // Mark read after loading
      markConversationRead(conversationId).catch(() => {});
    } catch (e) {
      setError('Failed to load messages');
    } finally {
      setLoading(l => ({ ...l, messages: false }));
    }
  }, []);

  useEffect(() => {
    if (state.user) {
      loadConversations();
    }
  }, [state.user, loadConversations]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  // After conversations load, open specific conversation if requested
  useEffect(() => {
    if (conversations.length > 0) {
      const pending = localStorage.getItem('openConversationId');
      if (pending) {
        const convId = parseInt(pending, 10);
        if (!isNaN(convId)) {
          setActiveConversationId(convId);
        }
        localStorage.removeItem('openConversationId');
      }
    }
  }, [conversations]);

  useEffect(() => {
    if (!conversations.length) {
      return;
    }
    const isActivePresent = activeConversationId ? conversations.some(c => c.id === activeConversationId) : false;
    if (!activeConversationId || !isActivePresent) {
      setActiveConversationId(conversations[0]?.id ?? null);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  // Realtime: handle incoming message
  const handleRealtimeMessage = useCallback((payload: { conversation_id: number; message: MessageItem }) => {
    console.log('📨 Received message via WebSocket:', { payload, activeConversationId });
    if (Number(payload.conversation_id) === Number(activeConversationId)) {
      setMessages(prev => {
        // Avoid duplicates by id
        if (prev.some(m => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      // Mark as read if current user is recipient
      if (payload.message.recipient_id === state.user?.id) {
        markConversationRead(payload.conversation_id).catch(() => {});
      }
    }
    // Refresh conversation list to update last message and unread counts
    loadConversations();
  }, [activeConversationId, loadConversations, state.user?.id]);

  const { connected: socketConnected, status: socketStatus } = useChatSocket({
    conversationId: activeConversationId,
    onMessage: handleRealtimeMessage,
    onConversationUpdate: () => loadConversations(),
    enabled: !!state.user,
  });

  const messagesContainerRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.length, activeConversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId) return;
    const optimistic: MessageItem = {
      id: Date.now() * -1,
      message: newMessage.trim(),
  sender_id: state.user?.id ?? 0,
      recipient_id: null,
      created_at: new Date().toISOString(),
      is_read: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');
    setLoading(l => ({ ...l, sending: true }));
    try {
      await sendMessage(activeConversationId, optimistic.message);
      // Remove optimistic message - the real one will come via WebSocket
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      // If socket not connected, fetch the real message
      if (!socketConnected) {
        setTimeout(() => {
          loadMessages(activeConversationId);
          loadConversations();
        }, 500);
      }
    } catch (e) {
      setError('Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setLoading(l => ({ ...l, sending: false }));
    }
  };

  const handleArchiveConversation = useCallback(async () => {
    const conversationId = activeConversationId;
    if (!conversationId) return;
    setLoading(l => ({ ...l, archiving: true }));
    setError(null);
    try {
      await archiveConversation(conversationId);
      setNotice('Conversation archived');
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      setActiveConversationId(prev => (prev === conversationId ? null : prev));
      setMessages([]);
      await loadConversations();
      if (showArchivedModal) {
        loadArchivedConversations();
      }
    } catch (e) {
      setError('Failed to archive conversation');
    } finally {
      setLoading(l => ({ ...l, archiving: false }));
    }
  }, [activeConversationId, loadConversations, loadArchivedConversations, showArchivedModal]);

  // Show placeholder if no conversations yet
  if (!loading.conversations && conversations.length === 0) {
    return (
      <div className="messages-page">
        <div className="placeholder-container">
          <div className="feature-placeholder">
            <div className="feature-placeholder__icon"><MessageIcon /></div>
            <h1 className="page-title-standalone">Messages</h1>
            <p className="page-subtitle">Start a conversation with a host once you have a booking or property inquiry. Messaging will attach to bookings and properties automatically.</p>
            <div className="feature-status">
              <div className="feature-status__item"><BuildingOfficeIcon /><span>Host-Guest Communication</span></div>
              <div className="feature-status__item"><UserGroupIcon /><span>Real-time Notifications (Planned)</span></div>
              <div className="feature-status__item"><MessageIcon /><span>Message History & Threading</span></div>
            </div>
                            {(archivedLoading || archivedConversations.length > 0 || archivedError) ? (
                <div className="archived-placeholder">
                  <p className="archived-placeholder__title">All of your conversations are currently archived.</p>
                  {archivedError && <div className="archived-placeholder__error">{archivedError}</div>}
                  <button
                    type="button"
                    className="archived-placeholder__btn"
                    onClick={() => {
                      setShowArchivedModal(true);
                      loadArchivedConversations();
                    }}
                    disabled={archivedLoading}
                  >
                    {archivedLoading ? 'Loading Archived Conversations…' : 'View Archived Conversations'}
                  </button>
                </div>
              ) : (
                <div className="feature-note"><p><strong>Tip:</strong> Create a booking to begin a conversation with a host. We'll surface your messages here.</p></div>
              )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <div className="messages-layout">
        <aside className="messages-sidebar">
          <div className="sidebar-header">
            <h2>Conversations {loading.conversations && <span style={{fontSize:'0.75rem', fontWeight:400}}>Loading...</span>}</h2>
            <button
              type="button"
              className="sidebar-header__archived-btn"
              onClick={() => {
                setShowArchivedModal(true);
                loadArchivedConversations();
              }}
              disabled={archivedLoading}
              aria-label="View archived conversations"
            >
              {archivedLoading ? 'Loading…' : 'Archived'}
            </button>
          </div>
          <div className="conversation-list">
            {conversations.map(conv => {
              const active = conv.id === activeConversationId;
              const userName = conv.other_user_first_name && conv.other_user_last_name
                ? `${conv.other_user_first_name} ${conv.other_user_last_name}`
                : 'User';
              return (
                <div
                  key={conv.id}
                  className={`conversation-item${active ? ' conversation-item--active' : ''}`}
                  onClick={() => setActiveConversationId(conv.id)}
                >
                  <div className="conversation-item__avatar">
                    <Avatar 
                      src={toAbsoluteImageUrl(conv.other_user_profile_image)}
                      alt={userName}
                      size={40}
                    />
                  </div>
                  <div className="conversation-item__details">
                    <div className="conversation-item__host-name">{userName}</div>
                    <div className="conversation-item__property-title">{conv.property_title}</div>
                    <div className="conversation-item__last-message">{conv.last_message_text || 'No messages yet'}</div>
                  </div>
                  {conv.unread_count > 0 && <div className="conversation-item__unread-badge">{conv.unread_count}</div>}
                </div>
              );
            })}
            {loading.conversations && conversations.length === 0 && <div style={{padding:'1rem', fontSize:'0.875rem'}}>Loading conversations...</div>}
          </div>
        </aside>
        <section className="chat-view">
          {activeConversation ? (
            <>
              <div className="chat-header">
                <div className="chat-header__user">
                  <Avatar
                    src={toAbsoluteImageUrl(activeConversation.other_user_profile_image)}
                    alt={activeConversation.other_user_first_name || 'User'}
                    size={36}
                    className="chat-header__avatar"
                  />
                  <div>
                    <h3
                      onClick={(e) => {
                        if (activeConversation.other_user_id) {
                          setProfilePopup({
                            visible: true,
                            user: {
                              id: activeConversation.other_user_id,
                              first_name: activeConversation.other_user_first_name || '',
                              last_name: activeConversation.other_user_last_name || '',
                              email: activeConversation.other_user_email || '',
                              phone: activeConversation.other_user_phone,
                              profile_image: activeConversation.other_user_profile_image,
                            },
                            position: { x: e.clientX, y: e.clientY }
                          });
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      title="Click to view profile"
                    >
                      {activeConversation.other_user_first_name && activeConversation.other_user_last_name
                        ? `${activeConversation.other_user_first_name} ${activeConversation.other_user_last_name}`
                        : 'User'}
                    </h3>
                    <span className="chat-header__property">{activeConversation.property_title}</span>
                  </div>
                </div>
                <div className="chat-header__meta">
                  {loading.messages && <span className="chat-header__meta-item">Loading...</span>}
                  {activeConversationId && (
                    <span className="chat-header__meta-item" style={{color: socketConnected ? 'var(--color-emerald-600)' : (socketStatus === 'connecting' ? 'var(--color-amber-500)' : 'var(--color-rose-500)')}}>
                      {socketStatus === 'connecting' && 'Connecting'}
                      {socketStatus === 'connected' && 'Live'}
                      {socketStatus !== 'connecting' && !socketConnected && socketStatus !== 'connected' && 'Offline'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="chat-header__archive-btn"
                    onClick={handleArchiveConversation}
                    disabled={loading.archiving}
                    aria-label="Archive conversation"
                  >
                    {loading.archiving ? 'Archiving…' : 'Archive'}
                  </button>
                </div>
              </div>
              <div className="messages-container" ref={messagesContainerRef}>
                {messages.map(msg => {
                  const isUser = msg.sender_id === state.user?.id;
                  return (
                    <div key={msg.id} className={`message-bubble-wrapper ${isUser ? 'message-bubble-wrapper--user' : 'message-bubble-wrapper--host'}`}>
                      <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--host'}`}>
                        <div>{msg.message}</div>
                        <span className="message-bubble__timestamp">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  );
                })}
                {!messages.length && !loading.messages && <div style={{opacity:0.6, fontSize:'0.85rem'}}>No messages yet. Say hello 👋</div>}
              </div>
              <form className="message-input-form" onSubmit={handleSend}>
                <input
                  type="text"
                  placeholder={loading.sending ? 'Sending...' : 'Type a message'}
                  value={newMessage}
                  disabled={loading.sending}
                  onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit" disabled={!newMessage.trim() || loading.sending} aria-label="Send message">
                  <MessageIcon />
                </button>
              </form>
            </>
          ) : (
            <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', padding:'2rem', textAlign:'center'}}>
              <MessageIcon />
              <p style={{marginTop:'1rem', fontSize:'0.9rem', color:'var(--color-slate-600)'}}>Select a conversation to view messages.</p>
            </div>
          )}
        </section>
      </div>

      {showArchivedModal && (
        <>
          <div
            className="archived-modal-overlay"
            onClick={() => setShowArchivedModal(false)}
          />
          <div className="archived-modal" role="dialog" aria-modal="true" aria-label="Archived conversations">
            <div className="archived-modal__header">
              <h3>Archived Conversations</h3>
              <button
                type="button"
                className="archived-modal__close"
                onClick={() => setShowArchivedModal(false)}
                aria-label="Close archived conversations"
              >
                ×
              </button>
            </div>
            <div className="archived-modal__body">
              {archivedLoading && (
                <div className="archived-modal__status">Loading archived conversations…</div>
              )}
              {!archivedLoading && archivedError && (
                <div className="archived-modal__error">{archivedError}</div>
              )}
              {!archivedLoading && !archivedError && (
                archivedConversations.length ? (
                  <ul className="archived-modal__list">
                    {archivedConversations.map(conv => {
                      const userName = conv.other_user_first_name && conv.other_user_last_name
                        ? `${conv.other_user_first_name} ${conv.other_user_last_name}`
                        : 'User';
                      const archivedAt = conv.participant_archived_at
                        ? new Date(conv.participant_archived_at).toLocaleString()
                        : 'Unknown date';
                      return (
                        <li key={conv.id} className="archived-modal__item">
                          <div className="archived-modal__item-header">
                            <span className="archived-modal__name">{userName}</span>
                            <span className="archived-modal__timestamp">Archived {archivedAt}</span>
                          </div>
                          {conv.property_title && (
                            <div className="archived-modal__property">{conv.property_title}</div>
                          )}
                          <div className="archived-modal__preview">{conv.last_message_text || 'No message preview available.'}</div>
                          <div className="archived-modal__actions">
                            <button
                              type="button"
                              className="archived-modal__restore-btn"
                              disabled={restoringConversationId === conv.id}
                              onClick={() => handleUnarchiveConversation(conv.id)}
                            >
                              {restoringConversationId === conv.id ? 'Restoring…' : 'Restore'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="archived-modal__status">No archived conversations yet.</div>
                )
              )}
            </div>
          </div>
        </>
      )}

      {/* User Profile Popup */}
      {profilePopup.visible && profilePopup.user && (
        <>
          <div
            className="profile-popup-overlay"
            onClick={() => setProfilePopup({ visible: false, user: null, position: { x: 0, y: 0 } })}
          />
          <div
            className="profile-popup"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="profile-popup__header">
              <h3>Contact Information</h3>
              <button
                onClick={() => setProfilePopup({ visible: false, user: null, position: { x: 0, y: 0 } })}
                className="profile-popup__close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="profile-popup__content">
              <div className="profile-popup__image-container">
                <Avatar
                  src={toAbsoluteImageUrl(profilePopup.user.profile_image)}
                  alt={`${profilePopup.user.first_name} ${profilePopup.user.last_name}`}
                  className="profile-popup__image"
                  size={80}
                />
              </div>
              <div className="profile-popup__field">
                <label>Name</label>
                <p>{profilePopup.user.first_name} {profilePopup.user.last_name}</p>
              </div>
              <div className="profile-popup__field">
                <label>Email</label>
                <p><a href={`mailto:${profilePopup.user.email}`}>{profilePopup.user.email}</a></p>
              </div>
              {profilePopup.user.phone && (
                <div className="profile-popup__field">
                  <label>Phone</label>
                  <p><a href={`tel:${profilePopup.user.phone}`}>{profilePopup.user.phone}</a></p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {notice && <div className="messages-notice" role="status">{notice}</div>}
      {error && <div className="messages-error" role="alert">{error}</div>}
    </div>
  );
};

export default MessagesPage;
