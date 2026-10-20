import React from 'react';
import { Trash2, ChevronUp, ChevronDown, ListMusic, Plus, Play } from 'lucide-react';
import { QueueItemDTO } from '@syncnshare/shared';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

interface QueueProps {
  roomId: string;
  queue: QueueItemDTO[];
  currentTrackId?: string | null;
  isHost: boolean;
  onOpenAddSong: () => void;
}

export const Queue: React.FC<QueueProps> = ({
  roomId,
  queue,
  currentTrackId,
  isHost,
  onOpenAddSong,
}) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const handleRemove = (itemId: string) => {
    if (!socket) return;
    socket.emit('queue:remove', { roomId, itemId });
  };

  const handlePlayNow = (trackId: string) => {
    if (!isHost || !socket) return;
    socket.emit('playback:play', { roomId, trackId, position: 0 });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!socket) return;
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;

    const [moved] = newQueue.splice(index, 1);
    newQueue.splice(targetIndex, 0, moved);

    const itemIds = newQueue.map((item) => item.id);
    socket.emit('queue:reorder', { roomId, itemIds });
  };

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-border mb-4">
        <div className="flex items-center space-x-2">
          <ListMusic className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-white text-base">Shared Queue</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-border text-slate-300">
            {queue.length}
          </span>
        </div>

        <button
          onClick={onOpenAddSong}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-xs font-semibold text-primary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Song</span>
        </button>
      </div>

      {/* Queue Items */}
      {queue.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <p className="text-sm">No songs in queue yet.</p>
          <button
            onClick={onOpenAddSong}
            className="text-xs text-primary hover:underline mt-2 font-medium"
          >
            Add a song to start listening
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
          {queue.map((item, index) => {
            const isPlaying = item.id === currentTrackId;
            const canRemove = isHost || item.addedBy?.id === user?.id;

            return (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between group transition-all ${
                  isPlaying
                    ? 'bg-primary/10 border-primary/40 shadow-sm'
                    : 'bg-surface border-surface-border hover:border-slate-600'
                }`}
              >
                {/* Thumbnail & Title */}
                <div className="flex items-center space-x-3 truncate flex-1 min-w-0 mr-3">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-surface-card flex-shrink-0 border border-white/5">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-xs">
                        {index + 1}
                      </div>
                    )}
                    {isPlaying && (
                      <div className="absolute inset-0 bg-primary/60 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="truncate flex-1">
                    <h4
                      className={`text-xs font-semibold truncate ${
                        isPlaying ? 'text-primary' : 'text-slate-200'
                      }`}
                      title={item.title}
                    >
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.artist || 'Unknown'} •{' '}
                      <span className="text-slate-400">
                        {item.addedBy?.displayName || 'Member'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                  {/* Host Play Now button */}
                  {isHost && !isPlaying && (
                    <button
                      onClick={() => handlePlayNow(item.id)}
                      title="Play track now"
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-surface-hover"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Reorder Buttons */}
                  <div className="flex flex-col">
                    <button
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      className="p-0.5 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={index === queue.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      className="p-0.5 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Delete Track */}
                  {canRemove && (
                    <button
                      onClick={() => handleRemove(item.id)}
                      title="Remove from queue"
                      className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
