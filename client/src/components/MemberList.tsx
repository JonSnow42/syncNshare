import React from 'react';
import { Crown, UserPlus, Users } from 'lucide-react';
import { RoomMemberDTO } from '@syncnshare/shared';

interface MemberListProps {
  members: RoomMemberDTO[];
  activeUsers: { id: string }[];
  onOpenInvite: () => void;
}

export const MemberList: React.FC<MemberListProps> = ({
  members,
  activeUsers,
  onOpenInvite,
}) => {
  const activeSet = new Set(activeUsers.map((u) => u.id));

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col shadow-lg">
      <div className="flex items-center justify-between pb-4 border-b border-surface-border mb-3">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-white text-base">Listeners</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-border text-slate-300">
            {members.length}
          </span>
        </div>

        <button
          onClick={onOpenInvite}
          className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-border text-slate-300 hover:text-white transition-colors"
          title="Invite Friend"
        >
          <UserPlus className="w-4 h-4 text-accent-cyan" />
        </button>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {members.map(({ user, role }) => {
          const isOnline = activeSet.has(user.id);

          return (
            <div
              key={user.id}
              className="p-2 rounded-xl bg-surface border border-surface-border flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5 truncate">
                <div className="relative">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.displayName}`}
                    alt={user.displayName}
                    className="w-7 h-7 rounded-full bg-surface-card border border-surface-border"
                  />
                  {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-surface" />
                  )}
                </div>

                <span className="text-xs font-semibold text-slate-200 truncate">
                  {user.displayName}
                </span>
              </div>

              {role === 'host' && (
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                  <Crown className="w-3 h-3" />
                  <span>Host</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
