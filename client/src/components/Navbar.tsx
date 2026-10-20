import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Radio,
  Users,
  Compass,
  PlusCircle,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Music,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CreateRoomModal } from './CreateRoomModal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <nav className="glass-panel sticky top-0 z-40 border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={user ? '/dashboard' : '/'} className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent-cyan flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                <Music className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-purple-300 bg-clip-text text-transparent">
                SyncNShare
              </span>
            </Link>

            {/* Desktop Navigation */}
            {user ? (
              <div className="hidden md:flex items-center space-x-6">
                <Link
                  to="/dashboard"
                  className="flex items-center space-x-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <Compass className="w-4 h-4 text-primary" />
                  <span>Explore Rooms</span>
                </Link>

                <Link
                  to="/friends"
                  className="flex items-center space-x-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <Users className="w-4 h-4 text-accent-cyan" />
                  <span>Friends</span>
                </Link>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium shadow-md shadow-primary/25 transition-all hover:shadow-primary/40 active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create Room</span>
                </button>

                {/* User menu */}
                <div className="flex items-center space-x-3 pl-4 border-l border-surface-border">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.displayName}`}
                    alt={user.displayName}
                    className="w-9 h-9 rounded-full bg-surface-card border border-surface-border object-cover"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-200 leading-tight">
                      {user.displayName}
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">
                      {user.email}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Log out"
                    className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-surface-hover"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-3 py-2"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium shadow-md shadow-primary/25 transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-surface-border bg-surface px-4 pt-3 pb-4 space-y-2">
            {user ? (
              <>
                <div className="flex items-center space-x-3 pb-3 border-b border-surface-border">
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.displayName}`}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full bg-surface-card border border-surface-border"
                  />
                  <div>
                    <div className="font-semibold text-white">{user.displayName}</div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                  </div>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-slate-200 hover:bg-surface-hover"
                >
                  <Compass className="w-4 h-4 text-primary" />
                  <span>Explore Rooms</span>
                </Link>
                <Link
                  to="/friends"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-slate-200 hover:bg-surface-hover"
                >
                  <Users className="w-4 h-4 text-accent-cyan" />
                  <span>Friends & Invitations</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-white bg-primary hover:bg-primary-hover"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create Room</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-rose-400 hover:bg-surface-hover"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2 rounded-lg text-slate-200 hover:bg-surface-hover"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2 rounded-lg bg-primary text-white"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} />}
    </>
  );
};
