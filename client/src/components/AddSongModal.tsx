import React, { useState } from 'react';
import { X, Music2, Link2, Sparkles } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';

interface AddSongModalProps {
  roomId: string;
  onClose: () => void;
  onAdded?: () => void;
}

const SAMPLE_SONGS = [
  {
    title: 'Lofi Hip Hop Radio',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    title: 'Synthwave Chill',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
  },
];

export const AddSongModal: React.FC<AddSongModalProps> = ({ roomId, onClose, onAdded }) => {
  const { socket } = useSocket();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setError('');
    setLoading(true);

    try {
      if (socket && socket.connected) {
        socket.emit('queue:add', { roomId, url: url.trim() }, (res) => {
          setLoading(false);
          if (res?.ok) {
            if (onAdded) onAdded();
            onClose();
          } else {
            setError(res?.error || 'Failed to add track to queue.');
          }
        });
      } else {
        await api.queue.add(roomId, url.trim());
        setLoading(false);
        if (onAdded) onAdded();
        onClose();
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to add track.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Music2 className="w-5 h-5 text-primary" />
            <span>Add Song to Queue</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
              Media URL (YouTube or Direct Audio)
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-surface-border text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors text-sm"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Supports standard YouTube links, Shorts, and direct .mp3 / .wav streams.
            </p>
          </div>

          {/* Quick Samples */}
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Or Try A Sample Track
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_SONGS.map((sample) => (
                <button
                  key={sample.url}
                  type="button"
                  onClick={() => setUrl(sample.url)}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-slate-300 hover:text-white hover:border-primary/50 transition-colors flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>{sample.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-surface text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium shadow-md shadow-primary/25 disabled:opacity-50 transition-all"
            >
              {loading ? 'Resolving Media...' : 'Add Track'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
