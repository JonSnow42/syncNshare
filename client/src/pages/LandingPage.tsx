import React from 'react';
import { Link } from 'react-router-dom';
import {
  Music,
  Users,
  Radio,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Disc3,
  Headphones,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-accent-cyan/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-4 pt-16 pb-20 text-center relative z-10">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-surface-card border border-surface-border text-xs font-semibold text-primary mb-6 animate-fade-in shadow-md">
          <Sparkles className="w-4 h-4 text-accent-cyan" />
          <span>The Next Generation Social Music Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Listen Together.{' '}
          <span className="bg-gradient-to-r from-primary via-purple-300 to-accent-cyan bg-clip-text text-transparent">
            In Perfect Real-Time Sync.
          </span>
        </h1>

        <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Create collaborative listening lounges, invite your friends, manage shared queues, and
          vibe together with authoritative low-latency synchronization and live chat.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={user ? '/dashboard' : '/register'}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-base shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center space-x-2"
          >
            <span>{user ? 'Go to Lounges' : 'Start Listening Free'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to={user ? '/dashboard' : '/login'}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-surface-card hover:bg-surface-hover border border-surface-border text-slate-200 font-semibold text-base transition-colors flex items-center justify-center space-x-2"
          >
            <Disc3 className="w-4 h-4 text-primary" />
            <span>Browse Public Lounges</span>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-20 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary mb-4">
            <Radio className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Authoritative Sync Engine</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Host-driven playback ensures every listener hears the exact same moment. Drift
            correction keeps everyone locked in step.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-accent-cyan/20 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Collaborative Queue</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Queue songs from YouTube or direct audio streams together. Reorder tracks, upvote, and
            curate the soundtrack for your night.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Private Social Rooms</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Hang out in private rooms with your close friends. Strict server-side access control,
            invite codes, and direct notifications.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-surface-border py-6 text-center text-xs text-slate-500 relative z-10">
        SyncNShare &bull; Real-Time Social Music Listening &bull; Production Architecture
      </footer>
    </div>
  );
};
