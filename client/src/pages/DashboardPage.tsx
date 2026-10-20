import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Search,
  PlusCircle,
  Users,
  Radio,
  Lock,
  Globe,
  Music2,
  KeyRound,
  Bell,
  Check,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CreateRoomModal } from '../components/CreateRoomModal';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteCodeError, setInviteCodeError] = useState('');

  // Fetch Public Rooms
  const {
    data: roomsData,
    isLoading: loadingRooms,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: ['rooms', searchTerm],
    queryFn: () => api.rooms.list(searchTerm),
  });

  // Fetch Pending Invitations
  const { data: invitesData, refetch: refetchInvites } = useQuery({
    queryKey: ['pendingInvitations'],
    queryFn: () => api.rooms.pendingInvitations(),
    enabled: !!user,
  });

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteCodeError('');
    const code = inviteCodeInput.trim();
    if (!code) return;

    // Direct room search or navigation
    try {
      // Find room by code or join
      // Navigate to room with code
      navigate(`/rooms/join?code=${encodeURIComponent(code)}`);
    } catch (err: any) {
      setInviteCodeError(err.message || 'Invalid invite code.');
    }
  };

  const handleRespondInvite = async (invId: string, action: 'accept' | 'decline') => {
    try {
      const res = await api.rooms.respondInvitation(invId, action);
      await refetchInvites();
      if (action === 'accept') {
        navigate(`/rooms/${res.roomId}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-surface-border relative overflow-hidden">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Social Music Lounge</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Welcome back, {user?.displayName || 'Friend'}!
          </h1>
          <p className="text-sm text-slate-300">
            Join a public listening room or create your own private lounge to stream music with friends in real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-lg shadow-primary/25 transition-all flex items-center space-x-2 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Lounge</span>
          </button>
        </div>
      </div>

      {/* Pending Room Invitations Banner */}
      {invitesData?.invitations && invitesData.invitations.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 border border-accent-cyan/30 bg-accent-cyan/5 space-y-3">
          <div className="flex items-center space-x-2 text-accent-cyan text-sm font-semibold">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>You have pending private room invitations!</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invitesData.invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-3 rounded-xl bg-surface border border-surface-border flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-white text-sm">{inv.room.name}</div>
                  <div className="text-xs text-slate-400">
                    Invited by {inv.inviter.displayName}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRespondInvite(inv.id, 'accept')}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Join</span>
                  </button>
                  <button
                    onClick={() => handleRespondInvite(inv.id, 'decline')}
                    className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-border text-slate-400 hover:text-rose-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Direct Code Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search public rooms..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-surface-border text-white placeholder-slate-500 focus:outline-none focus:border-primary text-sm transition-colors"
          />
        </div>

        {/* Enter by Code */}
        <form onSubmit={handleJoinByCode} className="w-full md:w-auto flex items-center space-x-2">
          <div className="relative flex-1 md:w-56">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder="Invite code (8 chars)"
              maxLength={12}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface border border-surface-border text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan text-sm uppercase font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-slate-200 text-sm font-semibold hover:text-white transition-colors flex-shrink-0"
          >
            Enter by Code
          </button>
        </form>
      </div>

      {/* Room Discovery Grid */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Compass className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-white">Active Public Lounges</h2>
        </div>

        {loadingRooms ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-surface animate-pulse border border-surface-border"
              />
            ))}
          </div>
        ) : roomsData?.rooms && roomsData.rooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomsData.rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => navigate(`/rooms/${room.id}`)}
                className="glass-card rounded-2xl overflow-hidden border border-surface-border cursor-pointer group flex flex-col justify-between"
              >
                {/* Lounge Top Bar with Gradient */}
                <div className={`p-5 bg-gradient-to-r ${room.coverGradient} relative`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[11px] font-semibold text-white">
                      {room.visibility === 'public' ? (
                        <Globe className="w-3 h-3 text-cyan-400" />
                      ) : (
                        <Lock className="w-3 h-3 text-purple-400" />
                      )}
                      <span className="capitalize">{room.visibility}</span>
                    </span>

                    <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[11px] font-semibold text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>{room.activeListenerCount} listening</span>
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white truncate group-hover:text-purple-200 transition-colors">
                    {room.name}
                  </h3>
                  {room.description && (
                    <p className="text-xs text-white/80 line-clamp-1 mt-1">{room.description}</p>
                  )}
                </div>

                {/* Lounge Details */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  {/* Currently Playing Track */}
                  <div className="p-3 rounded-xl bg-surface border border-surface-border">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Currently Playing
                    </span>
                    {room.currentTrack ? (
                      <div className="flex items-center space-x-2 truncate">
                        <Music2 className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-xs text-white font-medium truncate">
                          {room.currentTrack.title}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No track playing</span>
                    )}
                  </div>

                  {/* Host info and Enter button */}
                  <div className="flex items-center justify-between pt-2 border-t border-surface-border/50">
                    <div className="flex items-center space-x-2 truncate mr-2">
                      <img
                        src={room.host.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${room.host.displayName}`}
                        alt={room.host.displayName}
                        className="w-6 h-6 rounded-full bg-surface-card"
                      />
                      <span className="text-xs text-slate-400 truncate">
                        Host: <span className="text-slate-200 font-medium">{room.host.displayName}</span>
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                      Enter &rarr;
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-border flex items-center justify-center mx-auto text-slate-400">
              <Radio className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No Public Lounges Active</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
                Be the first to open a lounge! Start a room and invite your friends.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-lg shadow-primary/25 transition-all"
            >
              Create First Lounge
            </button>
          </div>
        )}
      </div>

      {showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
};
