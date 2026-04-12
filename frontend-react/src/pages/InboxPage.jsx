import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, Link } from 'react-router-dom';
import { Search, Send, User, MoreVertical, MessageSquare, Plus } from 'lucide-react';
import { apiFetch, auth } from '../utils/api';
import Layout from '../components/Layout';
import UserAvatar from '../components/UserAvatar';
import { getRelativeTime } from '../utils/formatters';

const InboxPage = () => {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat]       = useState(null);
  const [messages, setMessages]           = useState([]);
  const [newMessage, setNewMessage]       = useState('');
  const [loading, setLoading]             = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;
    const text = newMessage;
    setNewMessage('');
    try {
      await apiFetch('/send-message', {
        method: 'POST',
        body: JSON.stringify({ sender_id: parseInt(currentUserId), receiver_id: activeChat.id, message: text })
      });
      const data = await apiFetch(`/messages/${currentUserId}/${activeChat.id}`);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Send error:', err);
      setNewMessage(text);
    }
  };

  return (
    <Layout activePage="inbox">
      <div className="max-w-6xl mx-auto h-screen pt-4 pb-24 px-4 flex gap-4 overflow-hidden">

        {/* Left: Conversation List */}
        <div className="w-80 flex-shrink-0 card flex flex-col overflow-hidden">
          <div className="p-5 pb-3 border-b border-surface-border">
            <h1 className="font-display font-bold text-xl text-text-primary mb-3">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Search conversations…"
                className="input pl-9 text-sm py-2.5"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex gap-3 p-3 animate-pulse">
                    <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-2/3 rounded" />
                      <div className="skeleton h-2.5 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                {searchQuery ? 'No matches found' : 'No conversations yet'}
              </div>
            ) : (
              filteredConvos.map(convo => (
                <button
                  key={convo.id}
                  onClick={() => setActiveChat(convo)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left mb-1 ${
                    activeChat?.id === convo.id
                      ? 'bg-brand-secondary/50 border border-brand-primary/30'
                      : 'hover:bg-surface-muted border border-transparent'
                  }`}
                >
                  <div className="relative">
                    <UserAvatar src={convo.profile_image} name={convo.name} size="sm" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm text-text-primary truncate">{convo.name}</span>
                      <span className="text-[10px] font-bold text-brand-warm ml-2 flex-shrink-0">{convo.score}%</span>
                    </div>
                    <p className="text-xs text-text-muted truncate">
                      {convo.last_message || convo.occupation || 'Start a conversation'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Chat Window */}
        <div className="flex-1 card flex flex-col overflow-hidden min-w-0">
          {activeChat ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-surface-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <UserAvatar src={activeChat.profile_image} name={activeChat.name} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{activeChat.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-brand-secondary text-brand-warm text-[10px] font-bold">
                        {activeChat.score}% Match
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">{activeChat.city || activeChat.occupation || 'Hey Nomads member'}</p>
                  </div>
                </div>
                <Link
                  to={`/profile/${activeChat.id}`}
                  className="btn-ghost p-2.5"
                >
                  <User size={17} />
                </Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                    <MessageSquare size={40} className="text-brand-primary mb-3" />
                    <p className="text-sm font-semibold text-text-muted">
                      Say hello to {activeChat.name.split(' ')[0]}! 👋
                    </p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender_id == currentUserId;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-brand-primary text-text-primary rounded-br-md shadow-soft'
                            : 'bg-surface-muted text-text-primary border border-surface-border rounded-bl-md'
                        }`}>
                          <p>{msg.message}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-black/40' : 'text-text-muted'}`}>
                            {getRelativeTime(msg.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-surface-border flex-shrink-0">
                <div className="flex items-center gap-2 bg-surface-muted rounded-2xl border border-surface-border px-3 py-2 focus-within:border-brand-primary transition-colors">
                  <input
                    type="text"
                    placeholder={`Message ${activeChat.name.split(' ')[0]}…`}
                    className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted py-1.5 px-2"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="btn-primary py-2 px-3 flex-shrink-0 disabled:opacity-40"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-40">
              <MessageSquare size={60} className="text-brand-primary mb-4" />
              <h2 className="text-xl font-display font-bold text-text-primary mb-2">Your Inbox</h2>
              <p className="text-sm text-text-muted">Select a match to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default InboxPage;
