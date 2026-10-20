import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Globe, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface CreateRoomModalProps {
  onClose: () => void;
}

const GRADIENTS = [
  'from-violet-600 to-indigo-900',
  'from-cyan-500 to-blue-800',
  'from-emerald-500 to-teal-900',
  'from-rose-500 to-purple-900',
  'from-amber-500 to-red-900',
  'from-fuchsia-600 to-pink-900',
];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [capacity, setCapacity] = useState(50);
  const [coverGradient, setCoverGradient] = useState(GRADIENTS[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < 3) {
      setError('Room name must be at least 3 characters.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.rooms.create({
        name: name.trim(),
        description: description.trim(),
        visibility,
        capacity,
        coverGradient,
      });

      onClose();
      navigate(`/rooms/${res.room.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create listening room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header Preview */}
        <div className={`p-6 bg-gradient-to-r ${coverGradient} relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2 text-white/80 text-xs font-semibold tracking-wider uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Music Lounge</span>
          </div>
          <h2 className="text-2xl font-bold text-white truncate">
            {name || 'Name Your Room'}
          </h2>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
              Room Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Late Night Synthwave & Chill"
              required
              maxLength={60}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-surface-border text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of tunes are you playing?"
              rows={2}
              maxLength={250}
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-surface-border text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors text-sm resize-none"
            />
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center justify-center space-x-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                  visibility === 'public'
                    ? 'border-primary bg-primary/10 text-white shadow-sm'
                    : 'border-surface-border bg-surface text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Public Room</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center justify-center space-x-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                  visibility === 'private'
                    ? 'border-primary bg-primary/10 text-white shadow-sm'
                    : 'border-surface-border bg-surface text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-4 h-4 text-purple-400" />
                <span>Private Room</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {visibility === 'public'
                ? 'Anyone can discover and join this room from the lobby.'
                : 'Only invited friends or users with your invite code can enter.'}
            </p>
          </div>

          {/* Color Gradient Theme */}
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
              Lounge Vibe
            </label>
            <div className="flex space-x-3">
              {GRADIENTS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setCoverGradient(g)}
                  className={`w-8 h-8 rounded-full bg-gradient-to-r ${g} border-2 transition-transform ${
                    coverGradient === g ? 'scale-110 border-white ring-2 ring-primary' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-surface text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium shadow-md shadow-primary/25 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Creating...' : 'Create & Enter Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
