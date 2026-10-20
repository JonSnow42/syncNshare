import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  UserPlus,
  Check,
  X,
  UserMinus,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const FriendsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'search'>('friends');
  const [actionError, setActionError] = useState('');

  // 1. Friends list
  const { data: friendsData, refetch: refetchFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.friends.list(),
    enabled: !!user,
  });

  // 2. Pending requests
  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ['pendingFriends'],
    queryFn: () => api.friends.pending(),
    enabled: !!user,
  });

  // 3. User search
  const { data: searchData, refetch: refetchSearch } = useQuery({
    queryKey: ['userSearch', searchQuery],
    queryFn: () => api.users.search(searchQuery),
    enabled: searchQuery.trim().length > 0,
  });

  const handleSendRequest = async (recipientId: string) => {
    setActionError('');
    try {
      await api.friends.sendRequest(recipientId);
      await Promise.all([refetchPending(), refetchSearch()]);
    } catch (err: any) {
      setActionError(err.message || 'Failed to send friend request');
    }
  };

  const handleRespond = async (requestId: string, action: 'accept' | 'decline') => {
    setActionError('');
    try {
      await api.friends.respondRequest(requestId, action);
      await Promise.all([refetchFriends(), refetchPending()]);
    } catch (err: any) {
      setActionError(err.message || 'Failed to respond to request');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    setActionError('');
    try {
      await api.friends.remove(friendId);
      await refetchFriends();
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove friend');
    }
  };

  const pendingCount = (pendingData?.incoming.length || 0) + (pendingData?.outgoing.length || 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Users className="w-6 h-6 text-accent-cyan" />
            <span>Friends & Connections</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Connect with friends to invite each other to private listening lounges.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 bg-surface p-1 rounded-xl border border-surface-border text-xs font-semibold">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors ${
              activeTab === 'friends'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Friends ({friendsData?.friends.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${
              activeTab === 'pending'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Requests</span>
            {pendingCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-accent-cyan text-slate-950 font-bold flex items-center justify-center text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${
              activeTab === 'search'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Find People</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Friends Tab */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {friendsData?.friends && friendsData.friends.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {friendsData.friends.map(({ friendshipId, friend }) => (
                <div
                  key={friendshipId}
                  className="glass-card rounded-2xl p-4 border border-surface-border flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <img
                      src={friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.displayName}`}
                      alt={friend.displayName}
                      className="w-10 h-10 rounded-full bg-surface-card border border-surface-border flex-shrink-0"
                    />
                    <div className="truncate">
                      <div className="font-semibold text-white text-sm truncate">
                        {friend.displayName}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{friend.email}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Remove Friend"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-semibold text-white">No Friends Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Search for other music lovers by name or email and connect to share listening lounges.
              </p>
              <button
                onClick={() => setActiveTab('search')}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors mt-2"
              >
                Find People
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* Incoming */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Incoming Requests ({pendingData?.incoming.length || 0})
            </h3>
            {pendingData?.incoming && pendingData.incoming.length > 0 ? (
              <div className="space-y-2.5">
                {pendingData.incoming.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl bg-surface border border-surface-border flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={req.requester.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.requester.displayName}`}
                        alt={req.requester.displayName}
                        className="w-9 h-9 rounded-full bg-surface-card"
                      />
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {req.requester.displayName}
                        </div>
                        <div className="text-xs text-slate-400">{req.requester.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRespond(req.id, 'accept')}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, 'decline')}
                        className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-border text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No incoming requests.</p>
            )}
          </div>

          {/* Outgoing */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Sent Requests ({pendingData?.outgoing.length || 0})
            </h3>
            {pendingData?.outgoing && pendingData.outgoing.length > 0 ? (
              <div className="space-y-2.5">
                {pendingData.outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl bg-surface border border-surface-border flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={req.recipient.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.recipient.displayName}`}
                        alt={req.recipient.displayName}
                        className="w-8 h-8 rounded-full bg-surface-card"
                      />
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {req.recipient.displayName}
                        </div>
                        <div className="text-xs text-slate-400">{req.recipient.email}</div>
                      </div>
                    </div>

                    <span className="flex items-center space-x-1 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                      <Clock className="w-3 h-3" />
                      <span>Pending</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No pending sent requests.</p>
            )}
          </div>
        </div>
      )}

      {/* 3. Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by display name or email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-surface-border text-white placeholder-slate-500 focus:outline-none focus:border-primary text-sm transition-colors"
            />
          </div>

          {searchData?.users && searchData.users.length > 0 ? (
            <div className="space-y-2.5">
              {searchData.users.map((u) => {
                const status = u.friendshipStatus;

                return (
                  <div
                    key={u.id}
                    className="p-3.5 rounded-xl bg-surface border border-surface-border flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.displayName}`}
                        alt={u.displayName}
                        className="w-9 h-9 rounded-full bg-surface-card"
                      />
                      <div>
                        <div className="font-semibold text-white text-sm">{u.displayName}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>

                    <div>
                      {status === 'friends' ? (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                          Friends
                        </span>
                      ) : status === 'pending_sent' ? (
                        <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
                          Request Sent
                        </span>
                      ) : status === 'pending_received' ? (
                        <span className="text-xs text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-3 py-1 rounded-lg">
                          Awaiting Your Approval
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(u.id)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm transition-all"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Friend</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : searchQuery.trim().length > 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No users found.</p>
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">
              Type a name or email to find people on SyncNShare.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
