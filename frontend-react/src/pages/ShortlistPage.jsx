import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ArrowRight, IndianRupee, MapPin, Calendar, Trash2, Scale } from 'lucide-react';
import { apiFetch, auth, resolveMediaUrl } from '../utils/api';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';

const ShortlistPage = () => {
    const userId = auth.getUserId();
    const [shortlist, setShortlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [compareList, setCompareList] = useState([]); // Stores IDs of users to compare

    useEffect(() => {
        loadShortlist();
    }, []);

    const loadShortlist = async () => {
        try {
            const data = await apiFetch(`/shortlist/${userId}`);
            setShortlist(data || []);
        } catch (err) {
            console.error('Failed to load shortlist');
        } finally {
            setLoading(false);
        }
    };

    const removeItem = async (targetId) => {
        try {
            await apiFetch('/shortlist', { method: 'DELETE', body: { userId, targetId } });
            setShortlist(s => s.filter(u => u.id !== targetId));
            setCompareList(c => c.filter(id => id !== targetId));
        } catch (err) {
            console.error('Remove error');
        }
    };

    const toggleCompare = (id) => {
        setCompareList(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-2)
        );
    };

    if (loading) return (
        <Layout activePage="shortlist">
            <div className="max-w-5xl mx-auto px-4 pt-12 text-center text-text-muted">Loading your shortlist...</div>
        </Layout>
    );

    return (
        <Layout activePage="shortlist">
            <div className="max-w-5xl mx-auto px-4 pt-8 pb-12">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-text-primary">Your Shortlist</h1>
                        <p className="text-text-muted text-sm mt-1">High-potential roommates you've saved</p>
                    </div>
                    {shortlist.length > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20 text-brand-warm text-sm font-bold">
                            <Scale size={16} />
                            {compareList.length}/2 Selected to Compare
                        </div>
                    )}
                </div>

                {shortlist.length === 0 ? (
                    <div className="card p-12 text-center">
                        <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
                            <Heart size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-text-primary mb-2">No shortlists yet</h2>
                        <p className="text-text-muted max-w-xs mx-auto mb-6">Explore potential roommates and save your favorites to compare them side-by-side.</p>
                        <Link to="/discover" className="btn-primary inline-flex">Go to Discover</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {shortlist.map((user) => (
                            <motion.div 
                                key={user.id} 
                                layoutId={`fav-${user.id}`}
                                className={`card overflow-hidden border-2 transition-all ${
                                    compareList.includes(user.id) ? 'border-brand-primary shadow-lg ring-4 ring-brand-primary/10' : 'border-transparent'
                                }`}
                            >
                                <div className="relative h-40 bg-surface-muted">
                                    {user.profile_image ? (
                                        <img src={resolveMediaUrl(user.profile_image)} className="w-full h-full object-cover" alt={user.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-brand-warm opacity-30">{user.name[0]}</div>
                                    )}
                                    <button 
                                        onClick={() => removeItem(user.id)}
                                        className="absolute top-3 right-3 p-2 bg-white/90 rounded-full text-red-500 hover:bg-white transition-all shadow-sm"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="p-5">
                                    <h3 className="text-lg font-bold text-text-primary mb-3">{user.name}</h3>
                                    
                                    <div className="space-y-2 mb-5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-text-muted flex items-center gap-1"><MapPin size={12} /> City</span>
                                            <span className="font-bold text-text-primary">{user.city || 'Not set'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-text-muted flex items-center gap-1"><IndianRupee size={12} /> Budget</span>
                                            <span className="font-bold text-text-primary">₹{(user.budget || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-text-muted flex items-center gap-1"><Calendar size={12} /> Move-in</span>
                                            <span className="font-bold text-text-primary">
                                                {user.move_in_date ? new Date(user.move_in_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Flexible'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => toggleCompare(user.id)}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                compareList.includes(user.id) 
                                                ? 'bg-brand-primary border-brand-primary text-text-primary' 
                                                : 'border-surface-border text-text-muted hover:border-brand-primary'
                                            }`}
                                        >
                                            {compareList.includes(user.id) ? 'Selected' : 'Compare'}
                                        </button>
                                        <Link to={`/profile/${user.id}`} className="p-2 border border-surface-border rounded-xl text-text-muted hover:text-brand-warm transition-all">
                                            <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Compare Bar */}
                <AnimatePresence>
                    {compareList.length === 2 && (
                        <motion.div 
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-4"
                        >
                            <div className="card p-2 shadow-2xl bg-white/90 backdrop-blur-md border-brand-primary border-2 flex items-center justify-between overflow-hidden">
                                <div className="flex items-center -space-x-4 pl-2">
                                    {compareList.map(id => {
                                        const u = shortlist.find(x => x.id === id);
                                        return (
                                            <div key={id} className="w-12 h-12 rounded-full border-4 border-white overflow-hidden bg-brand-secondary ring-2 ring-brand-primary/20">
                                                {u?.profile_image && (
                                                    <img src={resolveMediaUrl(u.profile_image)} className="w-full h-full object-cover" alt="" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="text-center px-4">
                                     <div className="text-[10px] font-bold text-brand-warm uppercase tracking-widest">Compare & Decide</div>
                                     <div className="text-xs font-bold text-text-primary">Lifestyle Overlap Analysis</div>
                                </div>
                                <Link 
                                    to={`/compare?u1=${compareList[0]}&u2=${compareList[1]}`} 
                                    className="btn-primary py-3 px-6 rounded-xl text-sm font-bold shadow-soft"
                                >
                                    Compare Now <ArrowRight size={16} />
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
};

export default ShortlistPage;
