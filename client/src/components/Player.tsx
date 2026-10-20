import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Radio,
  Music2,
  Sparkles,
} from 'lucide-react';
import { PlaybackStateDTO, QueueItemDTO } from '@syncnshare/shared';
import { useSocket } from '../context/SocketContext';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface PlayerProps {
  roomId: string;
  playback: PlaybackStateDTO;
  isHost: boolean;
  onOpenAddSong: () => void;
}

export const Player: React.FC<PlayerProps> = ({
  roomId,
  playback,
  isHost,
  onOpenAddSong,
}) => {
  const { socket } = useSocket();
  const playerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isYTReady, setIsYTReady] = useState(false);

  const currentTrack = playback.currentTrack;

  // Load YouTube Iframe API once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setIsYTReady(true);
      };
    } else {
      setIsYTReady(true);
    }
  }, []);

  // Calculate authoritative expected position
  const getExpectedPosition = () => {
    if (!playback.isPlaying) return playback.positionSeconds;
    const elapsed = (Date.now() - playback.serverTimestamp) / 1000;
    return playback.positionSeconds + Math.max(0, elapsed);
  };

  // Reconcile YouTube Player with authoritative state
  useEffect(() => {
    if (!isYTReady || !currentTrack || currentTrack.provider !== 'youtube') {
      return;
    }

    const containerId = 'youtube-player-element';

    if (!playerRef.current) {
      playerRef.current = new window.YT.Player(containerId, {
        videoId: currentTrack.mediaId,
        playerVars: {
          autoplay: playback.isPlaying ? 1 : 0,
          controls: 0, // Custom controls
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            event.target.setVolume(muted ? 0 : volume);
            const expected = getExpectedPosition();
            event.target.seekTo(expected, true);
            if (playback.isPlaying) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event: any) => {
            // When video naturally ends and user is host, skip to next track
            if (event.data === window.YT.PlayerState.ENDED && isHost) {
              handleSkipNext();
            }
          },
        },
      });
    } else {
      try {
        const player = playerRef.current;
        const currentVideoId = player.getVideoData?.()?.video_id;

        if (currentVideoId !== currentTrack.mediaId) {
          player.loadVideoById({
            videoId: currentTrack.mediaId,
            startSeconds: getExpectedPosition(),
          });
        } else {
          const currentTime = player.getCurrentTime?.() || 0;
          const expected = getExpectedPosition();

          // Drift reconciliation: if out of sync by > 1.5s, seekTo expected
          if (Math.abs(currentTime - expected) > 1.5) {
            player.seekTo(expected, true);
          }
        }

        if (playback.isPlaying) {
          player.playVideo?.();
        } else {
          player.pauseVideo?.();
        }
      } catch (err) {
        console.warn('YouTube player sync error:', err);
      }
    }
  }, [
    isYTReady,
    currentTrack?.mediaId,
    playback.isPlaying,
    playback.positionSeconds,
    playback.serverTimestamp,
  ]);

  // Direct Audio reconciliation
  useEffect(() => {
    if (!currentTrack || currentTrack.provider !== 'direct_audio' || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    const expected = getExpectedPosition();

    if (Math.abs(audio.currentTime - expected) > 1.5) {
      audio.currentTime = expected;
    }

    if (playback.isPlaying && audio.paused) {
      audio.play().catch(() => {});
    } else if (!playback.isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [
    currentTrack?.url,
    playback.isPlaying,
    playback.positionSeconds,
    playback.serverTimestamp,
  ]);

  // Local progress ticker for smooth UI progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentProgress(getExpectedPosition());
    }, 500);

    return () => clearInterval(interval);
  }, [playback.isPlaying, playback.positionSeconds, playback.serverTimestamp]);

  // Volume handler
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setMuted(false);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(newVol);
    }
    if (audioRef.current) {
      audioRef.current.volume = newVol / 100;
    }
  };

  const toggleMute = () => {
    const nextMute = !muted;
    setMuted(nextMute);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(nextMute ? 0 : volume);
    }
    if (audioRef.current) {
      audioRef.current.muted = nextMute;
    }
  };

  // Host playback controls
  const handleTogglePlay = () => {
    if (!isHost || !socket) return;
    if (playback.isPlaying) {
      socket.emit('playback:pause', { roomId, position: currentProgress });
    } else {
      socket.emit('playback:play', { roomId, position: currentProgress });
    }
  };

  const handleSeek = (newPosition: number) => {
    if (!isHost || !socket) return;
    setCurrentProgress(newPosition);
    socket.emit('playback:seek', { roomId, position: newPosition });
  };

  const handleSkipNext = () => {
    if (!isHost || !socket) return;
    socket.emit('playback:play', { roomId });
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = Math.floor(sec % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  // Empty queue view
  if (!currentTrack) {
    return (
      <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
        <div className="w-16 h-16 rounded-2xl bg-surface-border/50 flex items-center justify-center text-slate-400">
          <Music2 className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white">The Queue is Empty</h3>
          <p className="text-sm text-slate-400 max-w-sm">
            Add a song to start listening together with everyone in this room!
          </p>
        </div>
        <button
          onClick={onOpenAddSong}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-lg shadow-primary/25 transition-all active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span>Add First Song</span>
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Video / Visualizer Area */}
      <div className="relative aspect-video w-full bg-black/90 overflow-hidden flex items-center justify-center group">
        {currentTrack.provider === 'youtube' ? (
          <div className="w-full h-full">
            <div id="youtube-player-element" className="w-full h-full pointer-events-none" />
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3 p-6 text-center">
            <audio ref={audioRef} src={currentTrack.url} />
            <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center animate-pulse">
              <Radio className="w-10 h-10 text-primary" />
            </div>
            <span className="text-sm font-semibold text-slate-300">Direct Audio Stream</span>
          </div>
        )}

        {/* Live Sync Badge Overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{isHost ? 'You are Host (Broadcasting)' : 'Synchronized with Host'}</span>
        </div>
      </div>

      {/* Playback Controls & Info */}
      <div className="p-6 space-y-4">
        {/* Track Title and Artist */}
        <div className="flex items-center justify-between">
          <div className="truncate pr-4">
            <h3 className="text-lg font-bold text-white truncate" title={currentTrack.title}>
              {currentTrack.title}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              {currentTrack.artist || 'Unknown Artist'} • Added by{' '}
              <span className="text-slate-300 font-medium">
                {currentTrack.addedBy?.displayName || 'Member'}
              </span>
            </p>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={muted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-20 accent-primary cursor-pointer h-1.5 bg-surface-border rounded-lg"
            />
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-mono w-10 text-right">
              {formatSeconds(currentProgress)}
            </span>
            <input
              type="range"
              min="0"
              max={currentTrack.durationSeconds || Math.max(currentProgress + 10, 300)}
              value={currentProgress}
              disabled={!isHost}
              onChange={(e) => isHost && handleSeek(Number(e.target.value))}
              className={`flex-1 accent-primary h-1.5 bg-surface-border rounded-lg ${
                isHost ? 'cursor-pointer' : 'cursor-default opacity-80'
              }`}
            />
            <span className="text-xs text-slate-400 font-mono w-10">
              {currentTrack.durationSeconds ? formatSeconds(currentTrack.durationSeconds) : 'Live'}
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center space-x-4 pt-1">
          {isHost ? (
            <>
              <button
                onClick={handleTogglePlay}
                className="w-12 h-12 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-lg shadow-primary/30 transition-transform active:scale-95"
              >
                {playback.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <button
                onClick={handleSkipNext}
                className="p-3 rounded-full bg-surface-hover hover:bg-surface-border text-slate-300 hover:text-white transition-colors"
                title="Skip to Next Track"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="text-xs text-slate-400 italic">
              Playback is controlled authoritatively by the Room Host.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
