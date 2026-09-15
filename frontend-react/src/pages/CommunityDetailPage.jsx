import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, MapPin, Calendar, Clock, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch } from '../lib/api';
import { Card, Badge, Button, Spinner, SectionHeader } from '../components/UI';
import UserAvatar from '../components/UserAvatar';

const FadeIn = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const categoryVariant = { city: 'teal', interest: 'coral', culture: 'amber', support: 'success' };

export default function CommunityDetailPage() {
  const { id } = useParams();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    apiFetch(`/communities/${id}`)
      .then(setCommunity)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const toggleMembership = async () => {
    if (!community || toggling) return;
    setToggling(true);
    try {
      const endpoint = community.is_member ? 'leave' : 'join';
      await apiFetch(`/communities/${id}/${endpoint}`, { method: 'POST' });
      setCommunity(prev => ({
        ...prev,
        is_member: !prev.is_member,
        member_count: prev.is_member ? prev.member_count - 1 : prev.member_count + 1,
      }));
    } catch {}
    setToggling(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 pt-8 flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!community) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 pt-8 text-center py-24">
          <p className="text-text-muted mb-4">Community not found.</p>
          <Link to="/communities">
            <Button variant="secondary" size="sm">Back to communities</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const members = community.members || [];
  const events = community.events || [];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 space-y-8">
        <FadeIn>
          <Link to="/communities" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand-coral transition-colors mb-4">
            <ArrowLeft size={16} /> Back to communities
          </Link>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="overflow-hidden">
            <div className="h-40 bg-gradient-to-br from-brand-teal/10 to-brand-teal/5 flex items-center justify-center">
              {community.image ? (
                <img src={community.image} alt={community.name} className="w-full h-full object-cover" />
              ) : (
                <Users size={48} className="text-brand-teal/30" />
              )}
            </div>
            <div className="p-5 md:p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <Badge variant={categoryVariant[community.category] || 'teal'} className="mb-2">
                    {community.category}
                  </Badge>
                  <h1 className="text-xl md:text-2xl font-bold text-text-primary">{community.name}</h1>
                </div>
              </div>
              <p className="text-text-muted text-sm mb-4">{community.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted mb-5">
                <span className="flex items-center gap-1.5"><MapPin size={14} />{community.city}, {community.country}</span>
                <span className="flex items-center gap-1.5"><Users size={14} />{community.member_count} members</span>
                <span className="text-text-muted text-xs">by {community.creator_name}</span>
              </div>
              <Button
                variant={community.is_member ? 'secondary' : 'primary'}
                size="md"
                onClick={toggleMembership}
                disabled={toggling}
                className="w-full"
              >
                {toggling ? '...' : community.is_member ? 'Leave community' : 'Join community'}
              </Button>
            </div>
          </Card>
        </FadeIn>

        {events.length > 0 && (
          <FadeIn delay={0.15}>
            <SectionHeader title="Upcoming events" subtitle={`${events.length} event${events.length !== 1 ? 's' : ''}`} />
            <div className="space-y-3 mt-3">
              {events.map(event => (
                <Card key={event.id} interactive className="p-4">
                  <div className="flex gap-4">
                    <div className="w-14 h-14 rounded-xl bg-brand-amber/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-brand-amber font-bold text-lg leading-none">
                        {new Date(event.start_time).getDate()}
                      </span>
                      <span className="text-brand-amber text-[10px] uppercase font-semibold">
                        {new Date(event.start_time).toLocaleDateString('en', { month: 'short' })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-text-primary text-sm truncate">{event.title}</h4>
                      <p className="text-text-muted text-xs mt-1 flex items-center gap-1">
                        <MapPin size={11} />{event.location}
                      </p>
                      <p className="text-text-muted text-xs mt-1 flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(event.start_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </FadeIn>
        )}

        {members.length > 0 && (
          <FadeIn delay={0.25}>
            <SectionHeader title="Members" subtitle={`${members.length} member${members.length !== 1 ? 's' : ''}`} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
              {members.map(member => (
                <Card key={member.id} className="p-4 flex flex-col items-center text-center">
                  <UserAvatar src={member.profile_image} name={member.name} size="md" />
                  <p className="font-semibold text-text-primary text-sm mt-2 truncate w-full">{member.name}</p>
                  {member.role === 'creator' && (
                    <Badge variant="coral" className="mt-1 text-[10px]">Creator</Badge>
                  )}
                </Card>
              ))}
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.35}>
          <SectionHeader title="About" />
          <Card className="p-5">
            <p className="text-text-muted text-sm leading-relaxed whitespace-pre-line">{community.description}</p>
          </Card>
        </FadeIn>
      </div>
    </Layout>
  );
}
