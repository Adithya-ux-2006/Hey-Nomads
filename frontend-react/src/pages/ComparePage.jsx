import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Scale, CheckCircle2, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { apiFetch, auth, resolveMediaUrl } from '../utils/api';
import Layout from '../components/Layout';

const MetricsBar = ({ label, val1, val2, name1 = 'User 1', name2 = 'User 2', max = 5 }) => {
  const safeVal1 = val1 || 0;
  const safeVal2 = val2 || 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted">
        <span>{label}</span>
        <span>{(safeVal1 === safeVal2) ? 'Balanced' : 'Mismatch'}</span>
      </div>
      <div className="relative h-4 bg-surface-muted rounded-full overflow-hidden flex">
        <div 
          className="h-full bg-brand-primary border-r-2 border-white transition-all duration-1000" 
          style={{ width: `${(safeVal1 / max) * 100}%` }} 
        />
        <div 
          className="h-full bg-brand-warm opacity-70 transition-all duration-1000" 
          style={{ width: `${(safeVal2 / max) * 100}%` }} 
        />
      </div>
      <div className="flex justify-between text-[10px] font-medium text-text-secondary">
        <span>{name1}: {safeVal1}/{max}</span>
        <span>{name2}: {safeVal2}/{max}</span>
      </div>
    </div>
  );
};

const ComparePage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const u1_id = searchParams.get('u1');
    const u2_id = searchParams.get('u2');
    
    // Phase 3: State Management
    const [userA, setUserA] = useState(null);
    const [userB, setUserB] = useState(null);
    const [loading, setLoading] = useState(true);

    // Phase 6: Debugging
    console.log("u1:", u1_id, "u2:", u2_id);
    console.log("userA:", userA);
    console.log("userB:", userB);

    useEffect(() => {
        const load = async () => {
            try {
                // Phase 2: Fetch Data
                const [p1, p2] = await Promise.all([
                    apiFetch(`/profile/${u1_id}`),
                    apiFetch(`/profile/${u2_id}`)
                ]);
                setUserA(p1);
                setUserB(p2);
            } catch (err) {
                console.error('Failed to load profiles for comparison', err);
            } finally {
                setLoading(false);
            }
        };
        if (u1_id && u2_id) {
            load();
        } else {
            setLoading(false);
        }
    }, [u1_id, u2_id]);

    // Phase 4: Handle Loading + Errors
    if (loading) return <Layout activePage="shortlist"><div className="p-20 text-center text-text-muted">Analysing lifestyle data...</div></Layout>;
    
    // Phase 7: UI Fallback
    if (!userA || !userB) {
        return (
            <Layout activePage="shortlist">
                <div className="p-20 text-center">
                    <AlertTriangle className="mx-auto text-orange-500 mb-4" size={32} />
                    <h2 className="text-xl font-bold mb-2">Comparison Unavailable</h2>
                    <p className="text-text-muted mb-6">Failed to load matching profiles. One or both users may lack completed data.</p>
                    <button onClick={() => navigate(-1)} className="btn-primary">Go Back</button>
                </div>
            </Layout>
        );
    }

    // Phase 2 Logic: Timeline Compatibility
    const formatMonthDay = (dateStr) => {
        if (!dateStr) return "Not specified";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    let timelineStatus = "Move-in date not specified";
    let timelineMessage = "Cannot compare without both dates";
    let diffDays = null;
    let badgeClass = "bg-surface-muted text-text-muted";
    let badgeIcon = <AlertTriangle size={14} className="mr-1 inline-block mb-0.5" />;

    if (userA?.move_in_date && userB?.move_in_date) {
        diffDays = Math.round(Math.abs(new Date(userA.move_in_date) - new Date(userB.move_in_date)) / (1000 * 60 * 60 * 24));
        // Phase 5 Debug
        console.log("Timeline Status - UserA Date:", userA.move_in_date, "UserB Date:", userB.move_in_date, "diffDays:", diffDays);

        if (diffDays <= 7) {
            timelineStatus = "Excellent match";
            timelineMessage = "Move-in dates align well";
            badgeClass = "bg-green-100 text-green-700";
            badgeIcon = "✅";
        } else if (diffDays <= 30) {
            timelineStatus = "Moderate overlap";
            timelineMessage = "Reasonable move-in gap";
            badgeClass = "bg-orange-100 text-orange-700";
            badgeIcon = "⚠️";
        } else {
            timelineStatus = "Poor alignment";
            timelineMessage = "Dates are far apart";
            badgeClass = "bg-red-100 text-red-700";
            badgeIcon = "❌";
        }
    }

    return (
        <Layout activePage="shortlist">
            <div className="max-w-4xl mx-auto px-4 pt-6 pb-20">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => navigate(-1)} className="btn-ghost p-2">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Scale size={20} className="text-brand-warm" />
                        <h1 className="font-display font-bold text-xl">Comparing {userA?.name || 'User A'} vs {userB?.name || 'User B'}</h1>
                    </div>
                    <div className="w-10" />
                </div>

                {/* Profiles Side-by-Side */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {[userA, userB].map((p, i) => (
                        <div key={i} className="card p-4 text-center">
                            <div className="w-20 h-20 rounded-2xl mx-auto mb-3 overflow-hidden border-2 border-brand-primary/20">
                                <img 
                                    src={p?.profile_image ? resolveMediaUrl(p.profile_image) : 'https://via.placeholder.com/150'} 
                                    className="w-full h-full object-cover" 
                                    alt={p?.name || 'User'}
                                    onError={e => e.target.src = 'https://via.placeholder.com/150'}
                                />
                            </div>
                            <h2 className="font-bold text-text-primary">{p?.name || 'Unknown'}</h2>
                            <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">{p?.occupation || 'Professional'}</p>
                        </div>
                    ))}
                </div>

                {/* Data Insights */}
                <div className="space-y-6">
                    <div className="card p-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-6 flex items-center gap-2">
                            <Scale size={14} /> Lifestyle Alignment Metrics
                        </h3>
                        <div className="space-y-8">
                            <MetricsBar label="Cleanliness" val1={userA?.cleanliness} val2={userB?.cleanliness} name1={userA?.name} name2={userB?.name} />
                            <MetricsBar label="Noise Level" val1={userA?.noise_level} val2={userB?.noise_level} name1={userA?.name} name2={userB?.name} />
                            <MetricsBar label="Sleep Schedule" 
                                val1={userA?.sleep_time === 'early' ? 1 : userA?.sleep_time === 'late' ? 5 : 3} 
                                val2={userB?.sleep_time === 'early' ? 1 : userB?.sleep_time === 'late' ? 5 : 3} 
                                name1={userA?.name} name2={userB?.name}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Summary Box */}
                        <div className="card p-6 bg-brand-secondary/5 border-brand-primary/10">
                            <h4 className="text-[10px] font-bold uppercase text-brand-warm mb-4 flex items-center gap-1.5 whitespace-nowrap">
                                📅 Move-in Compatibility
                            </h4>
                            <div className="space-y-3 mb-5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-semibold px-1">{userA?.name || 'User A'}:</span>
                                    <span className="text-text-muted px-1">Available from {formatMonthDay(userA?.move_in_date)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-semibold px-1">{userB?.name || 'User B'}:</span>
                                    <span className="text-text-muted px-1">Available from {formatMonthDay(userB?.move_in_date)}</span>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-brand-primary/10 flex flex-col gap-1.5">
                                <div className={`inline-flex items-center self-start px-3 py-1.5 rounded-full text-xs font-bold ${badgeClass}`}>
                                    {typeof badgeIcon === 'string' ? <span className="mr-1.5 leading-none text-sm">{badgeIcon}</span> : badgeIcon} 
                                    {timelineStatus} {diffDays !== null && `(${diffDays}-day diff)`}
                                </div>
                                <span className="text-[10px] font-bold text-text-muted italic px-2 mt-1">
                                    {timelineMessage}
                                </span>
                            </div>
                        </div>

                        {/* Decision Box */}
                        <div className="card p-6 bg-brand-primary/10 border-brand-primary/20">
                            <h4 className="text-[10px] font-bold uppercase text-brand-deep mb-3">Decision Support</h4>
                            <p className="text-xs text-text-secondary leading-relaxed mb-4">
                                Based on both profiles, we recommend drafting a shared cleaning rota.
                            </p>
                            <Link 
                                to={userB?.id ? `/agreement/${userB.id}` : '#'} 
                                className="btn-primary w-full justify-center text-xs py-2.5"
                            >
                                <FileText size={14} /> Create Roommate Agreement
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ComparePage;
