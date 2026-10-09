import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Save, Download, CheckCircle, Info } from 'lucide-react';
import { auth, apiFetch } from '../lib/api';
import Layout from '../components/Layout';
import { ButtonLink, ErrorState, InlineError } from '../components/UI';

const AgreementEditor = () => {
    const { targetId } = useParams();
    const navigate = useNavigate();
    const userId = auth.getUserId();

    const [content, setContent] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [saveError, setSaveError] = useState(null);
    const [saved, setSaved] = useState(false);

    const load = React.useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const result = await apiFetch(`/agreement/${userId}/${targetId}`);
            setContent(result?.content || '');
            setStatus(result?.status || 'template');
        } catch (err) {
            setLoadError(err);
        } finally {
            setLoading(false);
        }
    }, [userId, targetId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        setSaving(true);
        setSaveError(null);
        setSaved(false);
        try {
            await apiFetch('/agreement', {
                method: 'POST',
                body: {
                    userA_id: userId,
                    userB_id: targetId,
                    content: content,
                },
            });
            setSaved(true);
            setStatus('draft');
        } catch (err) {
            setSaveError(err);
        } finally {
            setSaving(false);
        }
    };

    const downloadTxt = () => {
        const element = document.createElement("a");
        const file = new Blob([content], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = "Roommate_Agreement.txt";
        document.body.appendChild(element);
        element.click();
        // Drop the object URL, otherwise the blob stays in memory until reload.
        URL.revokeObjectURL(element.href);
        element.remove();
    };

    if (loading) {
        return (
            <Layout activePage="shortlist">
                <div className="max-w-3xl mx-auto px-4 py-24 text-center text-text-muted">
                    Loading your agreement...
                </div>
            </Layout>
        );
    }

    if (loadError) {
        return (
            <Layout activePage="shortlist">
                <div className="max-w-2xl mx-auto px-4 pt-16">
                    <ErrorState what="agreement" error={loadError} onRetry={load} />
                </div>
            </Layout>
        );
    }

    if (!content) {
        return (
            <Layout activePage="shortlist">
                <div className="max-w-2xl mx-auto px-4 pt-16 text-center">
                    <p className="text-text-muted mb-5">
                        There's no agreement to show yet. This usually means your
                        match no longer exists.
                    </p>
                    <ButtonLink to="/matches" variant="secondary">Back to matches</ButtonLink>
                </div>
            </Layout>
        );
    }

    return (
        <Layout activePage="shortlist">
            <div className="max-w-4xl mx-auto px-4 pt-6 pb-20">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-surface-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="font-display font-bold text-xl text-text-primary">Roommate Agreement</h1>
                            <p className="text-xs text-text-muted">Co-living Governance</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={downloadTxt} className="inline-flex items-center gap-2 border-2 border-surface-border bg-white px-4 py-2 rounded-full text-xs font-semibold text-text-primary hover:border-brand-coral transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral">
                             <Download size={14} /> Download
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="inline-flex items-center gap-2 bg-brand-coral px-5 py-2 rounded-full text-xs font-semibold text-white shadow-coral hover:bg-brand-coral-dark transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
                        >
                             {saving ? 'Saving...' : <><Save size={14} /> Save Draft</>}
                        </button>
                    </div>
                </div>

                <div className="mb-4 space-y-3">
                    {saveError && (
                        <InlineError error={saveError} onRetry={handleSave} />
                    )}
                    {saved && !saveError && (
                        <div role="status" className="p-3 bg-status-success/10 border border-status-success/20 rounded-xl text-status-success text-sm flex items-center justify-center gap-2">
                            <CheckCircle size={16} /> Draft saved. Share it with your roommate to agree.
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Editor Main */}
                    <div className="lg:col-span-2">
                        <div className="p-1 space-y-1 bg-white rounded-2xl border border-surface-border shadow-card">
                            <div className="bg-surface-muted/30 p-4 border-b border-surface-border">
                                <div className="flex items-center gap-2 text-xs font-bold text-text-muted">
                                    <FileText size={14} /> 
                                    {status === 'template' ? 'Starting template' : 'Your draft'}
                                </div>
                            </div>
                            <textarea
                                aria-label="Agreement text"
                                className="w-full min-h-[600px] p-8 text-sm font-mono leading-relaxed focus:outline-none border-none bg-transparent text-text-primary"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Write your roommate agreement here..."
                            />
                        </div>
                    </div>

                    {/* Sidebar Tips */}
                    <div className="space-y-4">
                        <div className="p-6 rounded-2xl bg-brand-teal/5 border border-brand-teal/20">
                            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                                <Info size={14} /> Negotiation Tips
                            </h3>
                            <ul className="space-y-3">
                                {[
                                    'Define clear guest boundaries',
                                    'Specific cleaning rota works best',
                                    'Agree on shared groceries',
                                    'Set noise-free work windows'
                                ].map((tip, i) => (
                                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-teal mt-1 flex-shrink-0" />
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="p-6 rounded-2xl bg-surface-muted text-xs text-text-muted leading-relaxed">
                            <strong>Note:</strong> This document is a mutual understanding between roommates. While it helps resolve conflicts, consult local laws for formal lease requirements in your city.
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default AgreementEditor;
