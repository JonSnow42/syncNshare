import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, UserPlus, Copy, Check, Users } from 'lucide-react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';

interface InviteFriendModalProps {
  roomId: string;
  inviteCode?: string;
  onClose: () => void;
}

export const InviteFriendModal: React.FC<InviteFriendModalProps> = ({
  roomId,
  inviteCode,
  onClose,
}) => {
  const { socket } = useSocket();
  const [copied, setCopied] = useState(false);
  const [invitedMap, setInvitedMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.friends.list(),
  });

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async (friendId: string) => {
    setError('');
    try {
      if (socket && socket.connected) {
        socket.emit('room:invite', { roomId, targetUserId: friendId }, (res) => {
          if (res?.ok) {
            setInvitedMap((prev) => ({ ...prev, [friendId]: true }));
          } else {
            setError(res?.error || 'Failed to send invitation');
          }
        });
      } else {
        await api.rooms.invite(roomId, friendId);
        setInvitedMap((prev) => ({ ...prev, [friendId]: true }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Users className="w-5 h-5 text-accent-cyan" />
            <span>Invite Friends to Lounge</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Invite Code Box */}
          {inviteCode && (
            <div className="p-3.5 rounded-xl bg-surface border border-surface-border flex items-center justify-between">
              <div>
                <span className="block text-xs text-slate-400 font-medium">Room Invite Code</span>
                <span className="text-base font-mono font-bold text-white tracking-widest">
                  {inviteCode}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-hover border border-surface-border text-xs text-slate-200 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}

          {/* Friends List */}
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Your Friends
            </span>

            {isLoading ? (
              <div className="py-6 text-center text-sm text-slate-400">Loading friends...</div>
            ) : data?.friends && data.friends.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {data.friends.map(({ friend }) => {
                  const isInvited = invitedMap[friend.id];
                  return (
                    <div
                      key={friend.id}
                      className="p-2.5 rounded-xl bg-surface border border-surface-border flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.displayName}`}
                          alt={friend.displayName}
                          className="w-8 h-8 rounded-full bg-surface-card"
                        />
                        <div>
                          <div className="text-sm font-semibold text-white">{friend.displayName}</div>
                          <div className="text-xs text-slate-400">{friend.email}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleInvite(friend.id)}
                        disabled={isInvited}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isInvited
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-primary hover:bg-primary-hover text-white shadow-sm'
                        }`}
                      >
                        {isInvited ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Invited</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            <span>Invite</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-400 bg-surface rounded-xl border border-surface-border p-4">
                You haven't added any friends yet. Add friends from the Friends tab!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
