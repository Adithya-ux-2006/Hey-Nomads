import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Home, CreditCard, Smartphone, Bus,
  BookOpen, ShieldCheck, Map, Stethoscope, ShoppingBag,
  Building2, GraduationCap, Briefcase, ChevronRight
} from 'lucide-react';
import Layout from '../components/Layout';
import { apiFetch } from '../lib/api';
import { Card, Badge, SectionHeader } from '../components/UI';

const categoryConfig = {
  housing: { icon: Home, color: 'bg-brand-coral', label: 'Housing' },
  transport: { icon: Bus, color: 'bg-brand-teal', label: 'Transport' },
  banking: { icon: CreditCard, color: 'bg-brand-amber', label: 'Banking' },
  sim: { icon: Smartphone, color: 'bg-violet-500', label: 'SIM Card' },
  healthcare: { icon: Stethoscope, color: 'bg-emerald-500', label: 'Healthcare' },
  groceries: { icon: ShoppingBag, color: 'bg-orange-500', label: 'Groceries' },
  government: { icon: Building2, color: 'bg-blue-500', label: 'Government' },
  university: { icon: GraduationCap, color: 'bg-indigo-500', label: 'University' },
  work: { icon: Briefcase, color: 'bg-slate-600', label: 'Work' },
  safety: { icon: ShieldCheck, color: 'bg-red-500', label: 'Safety' },
  neighbourhoods: { icon: Map, color: 'bg-teal-600', label: 'Neighbourhoods' },
  general: { icon: BookOpen, color: 'bg-gray-500', label: 'General' },
};

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

const CheckTask = ({ task, onToggle }) => (
  <motion.div
    whileTap={{ scale: 0.98 }}
    onClick={() => onToggle(task.id)}
    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
      task.completed
        ? 'bg-status-success/5 border-status-success/20'
        : 'bg-white border-surface-border hover:border-brand-coral/30'
    }`}
  >
    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
      task.completed ? 'bg-status-success text-white' : 'border-2 border-surface-border'
    }`}>
      {task.completed && <CheckCircle2 size={14} />}
    </div>
    <div className="flex-1 min-w-0">
      <span className={`text-sm font-medium ${task.completed ? 'text-text-muted line-through' : 'text-text-primary'}`}>
        {task.title}
      </span>
      {task.description && (
        <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{task.description}</p>
      )}
    </div>
  </motion.div>
);

const ResourceCard = ({ resource }) => (
  <a
    href={resource.url || '#'}
    target={resource.url ? '_blank' : undefined}
    rel={resource.url ? 'noopener noreferrer' : undefined}
    className="block"
  >
    <Card interactive className="p-4 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm text-text-primary truncate">{resource.title}</h4>
          <p className="text-xs text-text-muted mt-1 line-clamp-2">{resource.description}</p>
        </div>
        {resource.url && (
          <ChevronRight size={16} className="text-text-muted flex-shrink-0 mt-1" />
        )}
      </div>
      {resource.city && (
        <Badge variant="muted" className="mt-3">{resource.city}</Badge>
      )}
    </Card>
  </a>
);

export default function SettleInPage() {
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});

  useEffect(() => {
    Promise.all([
      apiFetch('/settlement').catch(() => []),
      apiFetch('/resources?city=Mumbai').catch(() => []),
    ])
      .then(([taskData, resourceData]) => {
        setTasks(Array.isArray(taskData) ? taskData : []);
        setResources(Array.isArray(resourceData) ? resourceData : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task || toggling[id]) return;

    setToggling(prev => ({ ...prev, [id]: true }));
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));

    try {
      const endpoint = task.completed
        ? `/settlement/${id}/uncomplete`
        : `/settlement/${id}/complete`;
      await apiFetch(endpoint, { method: 'POST' });
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: task.completed } : t));
    } finally {
      setToggling(prev => ({ ...prev, [id]: false }));
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount ? (completedCount / totalCount) * 100 : 0;

  const groupedResources = resources.reduce((acc, r) => {
    const cat = r.category || 'general';
    (acc[cat] = acc[cat] || []).push(r);
    return acc;
  }, {});

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
          <div className="skeleton h-10 w-48 rounded" />
          <div className="skeleton h-4 rounded-full" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-24 space-y-8">
        {/* Header */}
        <FadeIn>
          <SectionHeader
            title="Settle In"
            subtitle={totalCount
              ? `${completedCount} of ${totalCount} tasks completed`
              : 'Your settlement checklist'
            }
          />
        </FadeIn>

        {/* Progress Bar */}
        <FadeIn delay={0.1}>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">Progress</span>
              <span className="text-sm font-bold text-brand-teal">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2.5 bg-surface-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-brand-teal rounded-full"
              />
            </div>
          </Card>
        </FadeIn>

        {/* Checklist */}
        <FadeIn delay={0.15}>
          <SectionHeader
            title="Checklist"
            subtitle={`${completedCount} done`}
          />
          {tasks.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 size={32} className="mx-auto text-text-muted mb-3" />
              <p className="text-text-muted text-sm">No tasks yet. Complete onboarding to see your checklist.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {tasks.map(task => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <CheckTask task={task} onToggle={toggleTask} />
                </motion.div>
              ))}
            </div>
          )}
        </FadeIn>

        {/* Resources */}
        {Object.keys(groupedResources).length > 0 && (
          <FadeIn delay={0.2}>
            <SectionHeader
              title="Resources"
              subtitle="Helpful guides for your new city"
            />
            <div className="space-y-6 mt-4">
              {Object.entries(groupedResources).map(([cat, items]) => {
                const config = categoryConfig[cat] || categoryConfig.general;
                const Icon = config.icon;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.color}`}>
                        <Icon size={14} className="text-white" />
                      </div>
                      <h3 className="text-sm font-bold text-text-primary">{config.label}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map(r => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <ResourceCard resource={r} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </FadeIn>
        )}
      </div>
    </Layout>
  );
}
