import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Globe,
  Lock,
  LogOut,
  Users,
  Radio,
  UserPlus,
  Copy,
  Check,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import {
  RoomDetailDTO,
  RoomSummaryDTO,
  RoomMemberDTO,
  QueueItemDTO,
  PlaybackStateDTO,
  UserDTO,
} from '@syncnshare/shared';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Player } from '../components/Player';
import { Queue } from '../components/Queue';
import { Chat } from '../components/Chat';
import { MemberList } from '../components/MemberList';
import { AddSongModal } from '../components/AddSongModal';
import { InviteFriendModal } from '../components/InviteFriendModal';

export const RoomPage: React.FC = () => {
  const { id: roomId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();

  const [showAddSong, setShowAddSong] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [socketError, setSocketError] = useState('');

  // Local real-time room state
  const [room, setRoom] = useState<RoomSummaryDTO | null>(null);
  const [members, setMembers] = useState<RoomMemberDTO[]>([]);
  const [queue, setQueue] = useState<QueueItemDTO[]>([]);
  const [playback, setPlayback] = useState<PlaybackStateDTO | null>(null);
  const [activeUsers, setActiveUsers] = useState<UserDTO[]>([]);
  const [isHost, setIsHost] = useState(false);

  // Initial HTTP Fetch
  const {
    data: initialData,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => {
      if (!roomId) throw new Error('Missing room ID');

      // If user is not yet a member, try joining first with invite code if provided in URL
      const inviteCode = searchParams.get('code') || undefined;
      try {
        await api.rooms.join(roomId, inviteCode);
      } catch (err: any) {
        // If forbidden, let get(roomId) handle the error representation
      }

      return api.rooms.get(roomId);
    },
    enabled: !!roomId,
    retry: 1,
  });

  // Sync initial query state
  useEffect(() => {
    if (initialData) {
      setRoom(initialData.room);
      setMembers(initialData.members);
      setQueue(initialData.queue);
      setPlayback(initialData.playback);
      setIsHost(initialData.isHost);
    }
  }, [initialData]);

  // Socket.IO Room Collaboration Lifecycle
  useEffect(() => {
    if (!socket || !roomId) return;

    // Join room channel
    socket.emit('room:join', { roomId }, (res) => {
      if (!res?.ok) {
        setSocketError(res?.error || 'Failed to join real-time room channel.');
      }
    });

    // Event: Full room state upon connecting
    const handleRoomState = (data: {
      room: RoomSummaryDTO;
      members: RoomMemberDTO[];
      queue: QueueItemDTO[];
      playback: PlaybackStateDTO;
      activeUsers: UserDTO[];
    }) => {
      setRoom(data.room);
      setMembers(data.members);
      setQueue(data.queue);
      setPlayback(data.playback);
      setActiveUsers(data.activeUsers);
      if (user) {
        setIsHost(data.room.host.id === user.id);
      }
    };

    // Event: Presence updates
    const handlePresence = (data: { roomId: string; activeCount: number; activeUsers: UserDTO[] }) => {
      if (data.roomId === roomId) {
        setActiveUsers(data.activeUsers);
        setRoom((prev) => (prev ? { ...prev, activeListenerCount: data.activeCount } : null));
      }
    };

    // Event: Queue updates
    const handleQueueUpdated = (data: {
      roomId: string;
      queue: QueueItemDTO[];
      currentTrack: QueueItemDTO | null;
    }) => {
      if (data.roomId === roomId) {
        setQueue(data.queue);
        setPlayback((prev) => (prev ? { ...prev, currentTrack: data.currentTrack } : null));
      }
    };

    // Event: Playback updates
    const handlePlaybackUpdated = (data: { roomId: string; state: PlaybackStateDTO }) => {
      if (data.roomId === roomId) {
        setPlayback(data.state);
      }
    };

    const handleError = (err: { code: string; message: string }) => {
      setSocketError(err.message);
    };

    socket.on('room:state', handleRoomState);
    socket.on('room:presence', handlePresence);
    socket.on('queue:updated', handleQueueUpdated);
    socket.on('playback:updated', handlePlaybackUpdated);
    socket.on('error', handleError);

    return () => {
      socket.emit('room:leave', { roomId });
      socket.off('room:state', handleRoomState);
      socket.off('room:presence', handlePresence);
      socket.off('queue:updated', handleQueueUpdated);
      socket.off('playback:updated', handlePlaybackUpdated);
      socket.off('error', handleError);
    };
  }, [socket, roomId, user?.id]);

  const handleLeaveRoom = async () => {
    if (!roomId) return;
    try {
      await api.rooms.leave(roomId);
    } catch {}
    navigate('/dashboard');
  };

  const handleCopyInviteCode = () => {
    if (!room?.inviteCode) return;
    navigator.clipboard.writeText(room.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-slate-400">Entering listening lounge...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Restricted</h2>
        <p className="text-sm text-slate-400">
          {(loadError as any)?.message || 'This room is private or no longer available.'}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-5 py-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-surface-border text-sm font-semibold text-white transition-colors"
        >
          Return to Lounges
        </button>
      </div>
    );
  }

  if (!room || !playback) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      {socketError && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs flex items-center justify-between">
          <span>{socketError}</span>
          <button onClick={() => setSocketError('')} className="text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Room Header Top Bar */}
      <div
        className={`glass-card rounded-3xl p-6 bg-gradient-to-r ${room.coverGradient} border border-surface-border relative overflow-hidden shadow-2xl`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[11px] font-semibold text-white">
                {room.visibility === 'public' ? (
                  <Globe className="w-3 h-3 text-cyan-400" />
                ) : (
                  <Lock className="w-3 h-3 text-purple-400" />
                )}
                <span className="capitalize">{room.visibility} Lounge</span>
              </span>

              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[11px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{activeUsers.length} listening now</span>
              </span>

              {isHost && (
                <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold">
                  <Crown className="w-3 h-3" />
                  <span>You are Host</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{room.name}</h1>
            {room.description && (
              <p className="text-xs text-white/80 max-w-xl">{room.description}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {room.inviteCode && (
              <button
                onClick={handleCopyInviteCode}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 text-white text-xs font-semibold backdrop-blur-md transition-colors"
                title="Copy Room Invite Code"
              >
                {copiedCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode ? 'Code Copied' : `Code: ${room.inviteCode}`}</span>
              </button>
            )}

            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 text-white text-xs font-semibold backdrop-blur-md transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Invite Friends</span>
            </button>

            <button
              onClick={handleLeaveRoom}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold backdrop-blur-md transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Player + Queue (Left) & Chat + Members (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Player & Queue) */}
        <div className="lg:col-span-2 space-y-6">
          <Player
            roomId={room.id}
            playback={playback}
            isHost={isHost}
            onOpenAddSong={() => setShowAddSong(true)}
          />

          <Queue
            roomId={room.id}
            queue={queue}
            currentTrackId={playback.currentTrack?.id}
            isHost={isHost}
            onOpenAddSong={() => setShowAddSong(true)}
          />
        </div>

        {/* Right Column (Live Chat & Members) */}
        <div className="space-y-6 flex flex-col">
          <Chat roomId={room.id} />

          <MemberList
            members={members}
            activeUsers={activeUsers}
            onOpenInvite={() => setShowInviteModal(true)}
          />
        </div>
      </div>

      {showAddSong && (
        <AddSongModal
          roomId={room.id}
          onClose={() => setShowAddSong(false)}
        />
      )}

      {showInviteModal && (
        <InviteFriendModal
          roomId={room.id}
          inviteCode={room.inviteCode}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
};
