import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, Link } from 'react-router-dom';
import { Search, Send, User, MessageSquare, ArrowLeft } from 'lucide-react';
import { apiFetch, auth } from '../utils/api';
import Layout from '../components/Layout';
import UserAvatar from '../components/UserAvatar';
import { Button, Card, EmptyState, Spinner } from '../components/UI';
import { getRelativeTime } from '../utils/formatters';
import { staggerContainer, staggerItem } from '../utils/animations';

// ── Typing Indicator ───────────────────────────────────────────
const TypingIndicator = () => (
  <motion.div className="flex gap-1 px-4 py-3">
    {[0, 1, 2].map(i => (
      <motion.div
        key={i}
        animate={{ y: [0, -8, 0] }}
        transition={{
          repeat: Infinity,
          duration: 0.8,
          delay: i * 0.15,
        }}
        className="w-2 h-2 rounded-full bg-text-muted"
      />
    ))}
  </motion.div>
);

// ── Chat Message ──────────────────────────────────────────────
const ChatMessage = ({ message, isMe, onLoad }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onAnimationComplete={onLoad}
      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={`max-w-xs px-4 py-3 rounded-2xl text-sm shadow-sm ${
          isMe
            ? 'bg-gradient-to-br from-brand-primary to-brand-warm text-white rounded-br-none'
            : 'bg-surface-muted text-text-primary border border-surface-border rounded-bl-none'
        }`}
      >
        <p className="leading-relaxed">{message.message}</p>
        <p className={`text-xs mt-1.5 font-medium ${isMe ? 'text-white/60' : 'text-text-muted'}`}>
          {getRelativeTime(message.created_at)}
        </p>
      </motion.div>
    </motion.div>
  );
};

// ── Conversation List Item ───────────────────────────────────────
const ConversationItem = ({ convo, isActive, onClick }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left mb-1 border ${
        isActive
          ? 'bg-gradient-to-r from-brand-secondary/50 to-brand-primary/30 border-brand-primary shadow-soft'
          : 'bg-white hover:bg-surface-muted border-transparent'
      }`}
    >
      {/* Avatar with Status */}
      <motion.div
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        className="relative flex-shrink-0"
      >
        <UserAvatar src={convo.profile_image} name={convo.name} size="md" />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-status-success border-2 border-white rounded-full shadow-md"
        />
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-2">
          <span className="font-semibold text-sm text-text-primary truncate">
            {convo.name}
          </span>
          <motion.span
            animate={isActive ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-xs font-bold text-white bg-gradient-to-r from-brand-primary to-brand-warm px-2 py-1 rounded-full flex-shrink-0"
          >
            {convo.score || 0}%
          </motion.span>
        </div>
        <p className="text-xs text-text-muted truncate">
          {convo.last_message || convo.occupation || 'Start a conversation'}
        </p>
      </div>
    </motion.button>
  );
};

// ── Inbox Page ────────────────────────────────────────────────
const InboxPage = () => {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef(null);
  const location = useLocation();
  const currentUserId = auth.getUserId();

  const filteredConvos = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.occupation?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get('user');

    const load = async () => {
      try {
        const matches = await apiFetch(`/matches/${currentUserId}`);
        setConversations(Array.isArray(matches) ? matches : []);
        if (targetId) {
          const target = matches.find(m => m.id == targetId);
          if (target) setActiveChat(target);
        } else if (matches.length > 0) {
          setActiveChat(matches[0]);
        }
      } catch (err) {
        console.error('Inbox load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [location.search, currentUserId]);

  useEffect(() => {
    if (!activeChat) return;
    const load = async () => {
      try {
        const data = await apiFetch(`/messages/${currentUserId}/${activeChat.id}`);
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Messages load error:', err);
      }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [activeChat, currentUserId]);

  // Smooth scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || sending) return;

    const text = newMessage;
    setNewMessage('');
    setSending(true);

    try {
      await apiFetch('/send-message', {
        method: 'POST',
        body: {
          sender_id: parseInt(currentUserId, 10),
          receiver_id: activeChat.id,
          message: text,
        },
      });
      const data = await apiFetch(`/messages/${currentUserId}/${activeChat.id}`);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Send error:', err);
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleSelectChat = (convo) => {
    setActiveChat(convo);
    setShowMobileChat(true);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  return (
    <Layout activePage="inbox">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto h-screen pt-4 pb-24 px-4 flex gap-4 overflow-hidden"
      >
        {/* Left: Conversation List - Hidden on Mobile when chat is active */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`${
            showMobileChat ? 'hidden md:flex' : 'flex'
          } md:w-80 flex-shrink-0 w-full md:w-auto`}
        >
          <Card className="flex flex-col overflow-hidden w-full">
            {/* Header */}
            <div className="p-5 pb-3 border-b border-surface-border">
              <h1 className="font-display font-bold text-2xl text-text-primary mb-4">
                Messages
              </h1>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  size={16}
                />
                <motion.input
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  placeholder="Search conversations…"
                  className="input pl-9 text-sm py-2.5 w-full"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {loading ? (
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="space-y-2 p-2"
                >
                  {[1, 2, 3, 4].map(i => (
                    <motion.div
                      key={i}
                      variants={staggerItem}
                      className="flex gap-3 p-3"
                    >
                      <div className="skeleton w-12 h-12 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3 w-2/3 rounded" />
                        <div className="skeleton h-2.5 w-1/2 rounded" />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : filteredConvos.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 text-center"
                >
                  <EmptyState
                    icon={MessageSquare}
                    title="No conversations yet"
                    description={
                      searchQuery
                        ? 'No matches found'
                        : 'Start messaging with your matches to begin!'
                    }
                  />
                </motion.div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                >
                  {filteredConvos.map(convo => (
                    <motion.div key={convo.id} variants={staggerItem}>
                      <ConversationItem
                        convo={convo}
                        isActive={activeChat?.id === convo.id}
                        onClick={() => handleSelectChat(convo)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Right: Chat Window */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`${showMobileChat ? 'flex' : 'hidden md:flex'} flex-1`}
        >
          {activeChat ? (
            <Card className="flex flex-col overflow-hidden w-full">
              {/* Chat Header */}
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="p-4 border-b border-surface-border flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-white to-surface-muted"
              >
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleBackToList}
                    className="md:hidden"
                  >
                    <ArrowLeft size={18} />
                  </Button>
                  <UserAvatar src={activeChat.profile_image} name={activeChat.name} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">
                        {activeChat.name}
                      </span>
                      <motion.span
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="px-2 py-1 rounded-full bg-gradient-to-r from-brand-primary to-brand-warm text-white text-[10px] font-bold"
                      >
                        {activeChat.score || 0}% Match
                      </motion.span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {activeChat.city || activeChat.occupation || 'Hey Nomads member'}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/profile/${activeChat.id}`}
                  className="btn-ghost p-2.5 hidden sm:flex"
                >
                  <User size={18} />
                </Link>
              </motion.div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                <AnimatePresence mode="popLayout">
                  {messages.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="h-full flex flex-col items-center justify-center text-center"
                    >
                      <motion.div
                        animate={{ rotate: [0, -5, 5, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <MessageSquare
                          size={48}
                          className="text-brand-primary/40 mb-4"
                        />
                      </motion.div>
                      <p className="text-sm font-semibold text-text-muted">
                        Say hello to {activeChat.name?.split(' ')?.[0] || 'them'}! 👋
                      </p>
                      <p className="text-xs text-text-muted mt-2">
                        Start the conversation
                      </p>
                    </motion.div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMe = msg.sender_id == currentUserId;
                      return (
                        <ChatMessage
                          key={i}
                          message={msg}
                          isMe={isMe}
                          onLoad={
                            i === messages.length - 1 ? scrollToBottom : undefined
                          }
                        />
                      );
                    })
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <motion.form
                onSubmit={handleSend}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="p-4 border-t border-surface-border flex-shrink-0"
              >
                <div className="flex items-center gap-2 bg-surface-muted rounded-full border border-surface-border px-4 py-2 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition-all">
                  <motion.input
                    whileFocus={{ scale: 1.02 }}
                    type="text"
                    placeholder={`Message ${activeChat.name?.split(' ')?.[0] || 'them'}…`}
                    className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted py-2 px-1"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="flex-shrink-0 p-2 rounded-full text-white bg-gradient-to-r from-brand-primary to-brand-warm disabled:opacity-50 transition-all"
                  >
                    {sending ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                        <Send size={18} />
                      </motion.div>
                    ) : (
                      <Send size={18} />
                    )}
                  </motion.button>
                </div>
              </motion.form>
            </Card>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Your Inbox"
                description="Select a match to start chatting"
              />
            </div>
          )}
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default InboxPage;
