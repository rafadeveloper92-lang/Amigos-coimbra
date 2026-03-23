import { useEffect, useRef, useState, type FC, type ReactNode, type TouchEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Type,
  Smile,
  AtSign,
  Music2,
  MapPin,
  ImagePlus,
  Search,
  X,
  Check,
  Play,
  Pause,
  Move,
  Navigation,
  Star,
  Trash2,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { dataService } from '../services/dataService';
import { StorySticker } from '../types';
import { useAuth } from '../contexts/AuthContext';
import BrandWatermark from './BrandWatermark';

type ComposerPanel = 'none' | 'media' | 'text' | 'stickers' | 'mentions' | 'music' | 'location';
type MusicDisplayMode = 'album' | 'lyrics';

interface MusicTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  previewUrl?: string;
}

interface MentionProfile {
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface LocationSuggestion {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

interface OverlayTransform {
  x: number;
  y: number;
  scale: number;
}

interface TransformableProps {
  transform: OverlayTransform;
  onChange: (next: OverlayTransform) => void;
  centered?: boolean;
  className?: string;
  children: ReactNode;
  minScale?: number;
  maxScale?: number;
  onSelect?: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export interface StoryComposerPayload {
  caption?: string;
  textColor?: string;
  textFont?: string;
  locationName?: string;
  locationX?: number;
  locationY?: number;
  locationScale?: number;
  mentionTags?: string[];
  stickers?: StorySticker[];
  musicDisplayMode?: MusicDisplayMode;
  lyricsText?: string;
  mediaScale?: number;
  mediaX?: number;
  mediaY?: number;
  captionX?: number;
  captionY?: number;
  captionScale?: number;
  mentionX?: number;
  mentionY?: number;
  mentionScale?: number;
  musicX?: number;
  musicY?: number;
  musicScale?: number;
  music?: {
    title: string;
    artist?: string;
    coverUrl?: string;
    previewUrl?: string;
  };
}

interface StoryComposerProps {
  isOpen: boolean;
  file: File | null;
  previewUrl: string | null;
  uploading: boolean;
  error?: string | null;
  onClose: () => void;
  onSelectMedia: () => void;
  onPublish: (payload: StoryComposerPayload) => Promise<void> | void;
}

const STICKER_OPTIONS = ['🔥', '❤️', '😂', '🎉', '✨', '📸', '💙', '🚀', '😎', '🥳', '🎵', '⚽'];
const TEXT_COLORS = ['#ffffff', '#ffd60a', '#ff4d6d', '#22d3ee', '#a78bfa', '#22c55e', '#f97316'];
const FONT_OPTIONS = [
  { value: 'inherit', label: 'Normal' },
  { value: 'serif', label: 'Elegante' },
  { value: 'monospace', label: 'Mono' },
  { value: 'cursive', label: 'Script' },
];
const STICKER_POSITIONS = [
  { x: -120, y: -180 },
  { x: 120, y: -180 },
  { x: -100, y: -60 },
  { x: 100, y: -30 },
  { x: -120, y: 90 },
  { x: 120, y: 140 },
];
const TOP_MUSIC_TERMS = ['top brasil', 'viral brasil', 'pop hits', 'sertanejo', 'forró hits'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distance = (a: Touch, b: Touch) => {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const midpoint = (a: Touch, b: Touch) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});

const TransformableItem: FC<TransformableProps> = ({
  transform,
  onChange,
  centered = true,
  className = '',
  children,
  minScale = 0.5,
  maxScale = 3,
  onSelect,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const touchRef = useRef<{
    mode: 'none' | 'drag' | 'pinch';
    startX: number;
    startY: number;
    startDistance: number;
    startMidX: number;
    startMidY: number;
    initial: OverlayTransform;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startDistance: 0,
    startMidX: 0,
    startMidY: 0,
    initial: transform,
  });

  const mouseRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    initial: OverlayTransform;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    initial: transform,
  });

  useEffect(() => {
    const onMouseMove = (event: globalThis.MouseEvent) => {
      if (!mouseRef.current.active) return;
      const dx = event.clientX - mouseRef.current.startX;
      const dy = event.clientY - mouseRef.current.startY;
      onChange({
        ...mouseRef.current.initial,
        x: mouseRef.current.initial.x + dx,
        y: mouseRef.current.initial.y + dy,
      });
    };

    const onMouseUp = () => {
      if (!mouseRef.current.active) return;
      mouseRef.current.active = false;
      onInteractionEnd?.();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onChange, onInteractionEnd]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    onSelect?.();
    onInteractionStart?.();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchRef.current = {
        mode: 'drag',
        startX: touch.clientX,
        startY: touch.clientY,
        startDistance: 0,
        startMidX: 0,
        startMidY: 0,
        initial: { ...transform },
      };
      return;
    }

    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const mid = midpoint(first, second);
      touchRef.current = {
        mode: 'pinch',
        startX: 0,
        startY: 0,
        startDistance: distance(first, second),
        startMidX: mid.x,
        startMidY: mid.y,
        initial: { ...transform },
      };
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (touchRef.current.mode === 'none') return;
    event.preventDefault();

    if (touchRef.current.mode === 'drag' && event.touches.length === 1) {
      const touch = event.touches[0];
      const dx = touch.clientX - touchRef.current.startX;
      const dy = touch.clientY - touchRef.current.startY;
      onChange({
        ...touchRef.current.initial,
        x: touchRef.current.initial.x + dx,
        y: touchRef.current.initial.y + dy,
      });
      return;
    }

    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const currentDistance = distance(first, second);
      const currentMid = midpoint(first, second);
      const ratio = touchRef.current.startDistance > 0
        ? currentDistance / touchRef.current.startDistance
        : 1;
      const nextScale = clamp(touchRef.current.initial.scale * ratio, minScale, maxScale);
      const dx = currentMid.x - touchRef.current.startMidX;
      const dy = currentMid.y - touchRef.current.startMidY;
      onChange({
        ...touchRef.current.initial,
        x: touchRef.current.initial.x + dx,
        y: touchRef.current.initial.y + dy,
        scale: nextScale,
      });
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchRef.current = {
        mode: 'drag',
        startX: touch.clientX,
        startY: touch.clientY,
        startDistance: 0,
        startMidX: 0,
        startMidY: 0,
        initial: { ...transform },
      };
      return;
    }
    touchRef.current.mode = 'none';
    onInteractionEnd?.();
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    onSelect?.();
    onInteractionStart?.();
    mouseRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      initial: { ...transform },
    };
  };

  const baseClass = centered
    ? `absolute left-1/2 top-1/2 ${className}`
    : `absolute inset-0 ${className}`;

  const cssTransform = centered
    ? `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
    : `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;

  return (
    <div
      className={baseClass}
      style={{ transform: cssTransform, transformOrigin: 'center center', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
};

export default function StoryComposer({
  isOpen,
  file,
  previewUrl,
  uploading,
  error,
  onClose,
  onSelectMedia,
  onPublish,
}: StoryComposerProps) {
  const { user } = useAuth();
  const [panel, setPanel] = useState<ComposerPanel>('none');
  const [caption, setCaption] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textFont, setTextFont] = useState('inherit');
  const [locationName, setLocationName] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<MentionProfile[]>([]);
  const [mentionTags, setMentionTags] = useState<string[]>([]);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState<MusicTrack[]>([]);
  const [topTracks, setTopTracks] = useState<MusicTrack[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [musicDisplayMode, setMusicDisplayMode] = useState<MusicDisplayMode>('album');
  const [lyricsText, setLyricsText] = useState('');
  const [mediaTransform, setMediaTransform] = useState<OverlayTransform>({ x: 0, y: 0, scale: 1 });
  const [captionTransform, setCaptionTransform] = useState<OverlayTransform>({ x: 0, y: 0, scale: 1 });
  const [mentionTransform, setMentionTransform] = useState<OverlayTransform>({ x: 0, y: -220, scale: 1 });
  const [musicTransform, setMusicTransform] = useState<OverlayTransform>({ x: 0, y: -260, scale: 1 });
  const [locationTransform, setLocationTransform] = useState<OverlayTransform>({ x: 0, y: -320, scale: 1 });
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [favoriteTracks, setFavoriteTracks] = useState<MusicTrack[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null);
  const [activeDragTarget, setActiveDragTarget] = useState<string | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [trashProximity, setTrashProximity] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const dragTargetRef = useRef<string | null>(null);
  const overTrashRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setPanel('none');
    setCaption('');
    setTextColor('#ffffff');
    setTextFont('inherit');
    setLocationName('');
    setMentionQuery('');
    setMentionResults([]);
    setMentionTags([]);
    setStickers([]);
    setSelectedStickerId(null);
    setMusicQuery('');
    setMusicResults([]);
    setTopTracks([]);
    setSelectedMusic(null);
    setMusicDisplayMode('album');
    setLyricsText('');
    setMediaTransform({ x: 0, y: 0, scale: 1 });
    setCaptionTransform({ x: 0, y: 0, scale: 1 });
    setMentionTransform({ x: 0, y: -220, scale: 1 });
    setMusicTransform({ x: 0, y: -260, scale: 1 });
    setLocationTransform({ x: 0, y: -320, scale: 1 });
    setLocationSuggestions([]);
    setLocationLoading(false);
    setFavoriteTracks([]);
    setActiveDragTarget(null);
    setIsOverTrash(false);
    setTrashProximity(0);
    dragTargetRef.current = null;
    overTrashRef.current = false;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setPlayingTrackId(null);
  }, [isOpen, file, user?.id]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const syncViewportHeight = () => setViewportHeight(window.innerHeight);
    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight);
    return () => {
      window.removeEventListener('resize', syncViewportHeight);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !user?.id) {
      setFavoriteTracks([]);
      return;
    }

    let cancelled = false;
    const loadFavorites = async () => {
      const tracks = await dataService.getFavoriteTracks(user.id);
      if (!cancelled) {
        setFavoriteTracks(tracks as MusicTrack[]);
      }
    };

    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || panel !== 'mentions') return;
    const query = mentionQuery.trim();
    if (query.length < 2) {
      setMentionResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const { data, error: mentionError } = await supabase
        .from('profiles')
        .select('username, first_name, last_name, avatar_url')
        .ilike('username', `%${query}%`)
        .limit(8);

      if (mentionError) {
        setMentionResults([]);
        return;
      }

      const profiles = (data || [])
        .filter((profile: any) => !!profile.username)
        .filter((profile: any) => !mentionTags.includes(profile.username));
      setMentionResults(profiles as MentionProfile[]);
    }, 250);

    return () => clearTimeout(timeout);
  }, [isOpen, panel, mentionQuery, mentionTags]);

  const fetchTopTracks = async () => {
    setMusicLoading(true);
    try {
      const responses = await Promise.all(
        TOP_MUSIC_TERMS.map((term) =>
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=8`)
        )
      );

      const jsons = await Promise.all(
        responses.map(async (res) => (res.ok ? res.json() : { results: [] }))
      );

      const merged = jsons.flatMap((payload: any) =>
        (payload?.results || []).map((item: any) => ({
          trackId: item.trackId,
          trackName: item.trackName,
          artistName: item.artistName,
          artworkUrl100: item.artworkUrl100,
          previewUrl: item.previewUrl,
        }))
      );

      const unique = new Map<number, MusicTrack>();
      merged.forEach((track: MusicTrack) => {
        if (!unique.has(track.trackId)) unique.set(track.trackId, track);
      });
      setTopTracks(Array.from(unique.values()).slice(0, 20));
    } catch {
      setTopTracks([]);
    } finally {
      setMusicLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || panel !== 'music') return;
    const query = musicQuery.trim();

    if (query.length < 2) {
      setMusicResults([]);
      if (topTracks.length === 0) {
        fetchTopTracks();
      }
      return;
    }

    const timeout = setTimeout(async () => {
      setMusicLoading(true);
      try {
        const response = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`
        );
        if (!response.ok) {
          setMusicResults([]);
          return;
        }
        const payload = await response.json();
        const tracks = (payload?.results || []).map((item: any) => ({
          trackId: item.trackId,
          trackName: item.trackName,
          artistName: item.artistName,
          artworkUrl100: item.artworkUrl100,
          previewUrl: item.previewUrl,
        }));
        setMusicResults(tracks);
      } catch {
        setMusicResults([]);
      } finally {
        setMusicLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [isOpen, panel, musicQuery, topTracks.length]);

  useEffect(() => {
    if (!isOpen || panel !== 'location') return;
    const query = locationName.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`
        );
        if (!response.ok) {
          setLocationSuggestions([]);
          return;
        }
        const payload = await response.json();
        const suggestions = (payload || []).map((item: any) => ({
          id: item.place_id?.toString() || `${item.lat}-${item.lon}`,
          label: item.display_name,
          lat: Number(item.lat),
          lon: Number(item.lon),
        }));
        setLocationSuggestions(suggestions);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setLocationLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [isOpen, panel, locationName]);

  useEffect(() => {
    if (!selectedMusic) return;
    if (!lyricsText.trim()) {
      setLyricsText(`${selectedMusic.trackName} - ${selectedMusic.artistName}`);
    }
  }, [selectedMusic, lyricsText]);

  const toggleTrackPreview = async (track: MusicTrack) => {
    if (!track.previewUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (playingTrackId === track.trackId) {
      audio.pause();
      setPlayingTrackId(null);
      return;
    }

    try {
      audio.src = track.previewUrl;
      audio.currentTime = 0;
      await audio.play();
      setPlayingTrackId(track.trackId);
    } catch {
      setPlayingTrackId(null);
    }
  };

  const handleSelectTrack = async (track: MusicTrack) => {
    setSelectedMusic(track);
    if (track.previewUrl) {
      await toggleTrackPreview(track);
    }
  };

  const handleSaveFavoriteTrack = async (track: MusicTrack) => {
    if (!user?.id) return;
    const exists = favoriteTracks.some((item) => item.trackId === track.trackId);
    if (exists) return;

    try {
      await dataService.saveFavoriteTrack(user.id, track);
      setFavoriteTracks((prev) => [track, ...prev].slice(0, 40));
    } catch (error) {
      console.error('Erro ao salvar música favorita:', error);
    }
  };

  const handleRemoveFavoriteTrack = async (trackId: number) => {
    if (!user?.id) return;
    try {
      await dataService.removeFavoriteTrack(user.id, trackId);
      setFavoriteTracks((prev) => prev.filter((item) => item.trackId !== trackId));
    } catch (error) {
      console.error('Erro ao remover música favorita:', error);
    }
  };

  const handleAddMention = (username: string) => {
    const normalized = username.replace('@', '').trim();
    if (!normalized || mentionTags.includes(normalized)) return;
    setMentionTags((prev) => [...prev, normalized]);
    setMentionQuery('');
    setMentionResults([]);
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          if (!response.ok) return;
          const payload = await response.json();
          if (payload?.display_name) {
            setLocationName(payload.display_name);
          }
        } finally {
          setLocationLoading(false);
        }
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAddSticker = (label: string) => {
    const position = STICKER_POSITIONS[stickers.length % STICKER_POSITIONS.length];
    const sticker: StorySticker = {
      id: `${Date.now()}-${Math.random()}`,
      label,
      x: position.x,
      y: position.y,
      scale: 1,
    };
    setStickers((prev) => [...prev, sticker]);
    setSelectedStickerId(sticker.id);
  };

  const selectedSticker = stickers.find((sticker) => sticker.id === selectedStickerId);
  const tracksToDisplay = musicQuery.trim().length >= 2 ? musicResults : topTracks;

  const trashCenterY = (viewportHeight > 0 ? viewportHeight : 800) / 2 - 90;
  const isOverDeleteZone = (transform: OverlayTransform) => (
    Math.abs(transform.x) <= 92 && Math.abs(transform.y - trashCenterY) <= 86
  );

  const getTrashProximity = (transform: OverlayTransform) => {
    const dx = transform.x;
    const dy = transform.y - trashCenterY;
    const dist = Math.sqrt((dx * dx) + (dy * dy));
    return clamp(1 - dist / 230, 0, 1);
  };

  const startDraggingTarget = (target: string) => {
    dragTargetRef.current = target;
    overTrashRef.current = false;
    setActiveDragTarget(target);
    setIsOverTrash(false);
    setTrashProximity(0);
  };

  const updateDraggingTarget = (target: string, next: OverlayTransform) => {
    if (dragTargetRef.current !== target) return;
    setTrashProximity(getTrashProximity(next));
    const overTrash = isOverDeleteZone(next);
    overTrashRef.current = overTrash;
    setIsOverTrash(overTrash);
  };

  const clearDragState = () => {
    dragTargetRef.current = null;
    overTrashRef.current = false;
    setActiveDragTarget(null);
    setIsOverTrash(false);
    setTrashProximity(0);
  };

  const removeTargetByKey = (target: string | null) => {
    if (!target) return;
    if (target === 'caption') {
      setCaption('');
      return;
    }
    if (target === 'location') {
      setLocationName('');
      setLocationSuggestions([]);
      return;
    }
    if (target === 'mention') {
      setMentionTags([]);
      return;
    }
    if (target === 'music') {
      setSelectedMusic(null);
      setLyricsText('');
      setMusicDisplayMode('album');
      return;
    }
    if (target.startsWith('sticker:')) {
      const stickerId = target.replace('sticker:', '');
      setStickers((prev) => prev.filter((item) => item.id !== stickerId));
      setSelectedStickerId((prev) => (prev === stickerId ? null : prev));
    }
  };

  const finishDraggingTarget = () => {
    const target = dragTargetRef.current;
    const shouldDelete = overTrashRef.current;
    clearDragState();
    if (shouldDelete) {
      removeTargetByKey(target);
    }
  };

  const handleCaptionTransformChange = (next: OverlayTransform) => {
    setCaptionTransform(next);
    updateDraggingTarget('caption', next);
  };

  const handleLocationTransformChange = (next: OverlayTransform) => {
    setLocationTransform(next);
    updateDraggingTarget('location', next);
  };

  const handleMentionTransformChange = (next: OverlayTransform) => {
    setMentionTransform(next);
    updateDraggingTarget('mention', next);
  };

  const handleMusicTransformChange = (next: OverlayTransform) => {
    setMusicTransform(next);
    updateDraggingTarget('music', next);
  };

  const handleStickerTransformChange = (stickerId: string, next: OverlayTransform) => {
    setStickers((prev) =>
      prev.map((item) =>
        item.id === stickerId ? { ...item, x: next.x, y: next.y, scale: next.scale } : item
      )
    );
    updateDraggingTarget(`sticker:${stickerId}`, next);
  };

  const handlePublish = async () => {
    if (!file) return;
    clearDragState();
    await onPublish({
      caption: caption.trim() || undefined,
      textColor: textColor || undefined,
      textFont: textFont || undefined,
      locationName: locationName.trim() || undefined,
      locationX: locationTransform.x,
      locationY: locationTransform.y,
      locationScale: locationTransform.scale,
      mentionTags: mentionTags.length > 0 ? mentionTags : undefined,
      stickers: stickers.length > 0 ? stickers : undefined,
      musicDisplayMode,
      lyricsText: musicDisplayMode === 'lyrics' ? lyricsText.trim() || undefined : undefined,
      mediaScale: mediaTransform.scale,
      mediaX: mediaTransform.x,
      mediaY: mediaTransform.y,
      captionX: captionTransform.x,
      captionY: captionTransform.y,
      captionScale: captionTransform.scale,
      mentionX: mentionTransform.x,
      mentionY: mentionTransform.y,
      mentionScale: mentionTransform.scale,
      musicX: musicTransform.x,
      musicY: musicTransform.y,
      musicScale: musicTransform.scale,
      music: selectedMusic
        ? {
            title: selectedMusic.trackName,
            artist: selectedMusic.artistName,
            coverUrl: selectedMusic.artworkUrl100,
            previewUrl: selectedMusic.previewUrl,
          }
        : undefined,
    });
  };

  const handleClose = () => {
    clearDragState();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setPlayingTrackId(null);
    onClose();
  };

  if (!isOpen) return null;

  const composerContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black"
    >
      <audio ref={audioRef} onEnded={() => setPlayingTrackId(null)} />

      <div className="relative w-full h-full overflow-hidden bg-black select-none">
        <TransformableItem
          centered={false}
          transform={mediaTransform}
          onChange={setMediaTransform}
          className="touch-none"
          minScale={1}
          maxScale={3}
        >
          {previewUrl ? (
            file?.type.startsWith('video') ? (
              <video src={previewUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
            ) : (
              <img src={previewUrl} alt="Story preview" className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/80">
              Selecione uma foto ou vídeo
            </div>
          )}
        </TransformableItem>

        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/45 pointer-events-none" />

        {selectedMusic && musicDisplayMode === 'album' && (
          <TransformableItem
            transform={musicTransform}
            onChange={handleMusicTransformChange}
            className="z-20"
            minScale={0.7}
            maxScale={2.4}
            onInteractionStart={() => startDraggingTarget('music')}
            onInteractionEnd={finishDraggingTarget}
          >
            <div className="bg-black/55 text-white rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-2">
              {selectedMusic.artworkUrl100 ? (
                <img src={selectedMusic.artworkUrl100} alt={selectedMusic.trackName} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <Music2 className="w-3.5 h-3.5" />
              )}
              <span className="truncate max-w-[220px]">
                {selectedMusic.trackName} {selectedMusic.artistName ? `- ${selectedMusic.artistName}` : ''}
              </span>
            </div>
          </TransformableItem>
        )}

        {selectedMusic && musicDisplayMode === 'lyrics' && (
          <TransformableItem
            transform={musicTransform}
            onChange={handleMusicTransformChange}
            className="z-20 w-[80vw] overflow-hidden"
            minScale={0.7}
            maxScale={2.4}
            onInteractionStart={() => startDraggingTarget('music')}
            onInteractionEnd={finishDraggingTarget}
          >
            <motion.div
              className="text-white text-base font-bold whitespace-nowrap drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
              initial={{ x: '100%' }}
              animate={{ x: '-120%' }}
              transition={{ repeat: Infinity, duration: 9, ease: 'linear' }}
            >
              {lyricsText || `${selectedMusic.trackName} - ${selectedMusic.artistName}`}
            </motion.div>
          </TransformableItem>
        )}

        {locationName && (
          <TransformableItem
            transform={locationTransform}
            onChange={handleLocationTransformChange}
            className="z-20"
            minScale={0.7}
            maxScale={2.4}
            onInteractionStart={() => startDraggingTarget('location')}
            onInteractionEnd={finishDraggingTarget}
          >
            <div className="bg-black/55 text-white rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-2 max-w-[70vw]">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{locationName}</span>
            </div>
          </TransformableItem>
        )}

        {mentionTags.length > 0 && (
          <TransformableItem
            transform={mentionTransform}
            onChange={handleMentionTransformChange}
            className="z-20"
            minScale={0.7}
            maxScale={2.4}
            onInteractionStart={() => startDraggingTarget('mention')}
            onInteractionEnd={finishDraggingTarget}
          >
            <div className="flex flex-wrap gap-2 justify-center max-w-[80vw]">
              {mentionTags.map((tag) => (
                <span key={tag} className="bg-black/55 text-white text-xs font-semibold rounded-full px-2.5 py-1">
                  @{tag}
                </span>
              ))}
            </div>
          </TransformableItem>
        )}

        {stickers.map((sticker) => (
          <TransformableItem
            key={sticker.id}
            transform={{ x: sticker.x, y: sticker.y, scale: sticker.scale || 1 }}
            onChange={(next) => handleStickerTransformChange(sticker.id, next)}
            className={`z-20 text-3xl md:text-4xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] ${
              selectedStickerId === sticker.id ? 'ring-2 ring-white/70 rounded-lg' : ''
            }`}
            minScale={0.5}
            maxScale={3}
            onSelect={() => setSelectedStickerId(sticker.id)}
            onInteractionStart={() => {
              setSelectedStickerId(sticker.id);
              startDraggingTarget(`sticker:${sticker.id}`);
            }}
            onInteractionEnd={finishDraggingTarget}
          >
            {sticker.label}
          </TransformableItem>
        ))}

        {caption && (
          <TransformableItem
            transform={captionTransform}
            onChange={handleCaptionTransformChange}
            className="z-20 text-center px-4"
            minScale={0.6}
            maxScale={3}
            onInteractionStart={() => startDraggingTarget('caption')}
            onInteractionEnd={finishDraggingTarget}
          >
            <p
              className="text-3xl md:text-4xl font-black break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
              style={{ color: textColor, fontFamily: textFont }}
            >
              {caption}
            </p>
          </TransformableItem>
        )}

        <div className="absolute right-4 bottom-24 z-20">
          <BrandWatermark />
        </div>

        <AnimatePresence>
          {activeDragTarget && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{
                opacity: 1,
                y: isOverTrash ? -8 : -(trashProximity * 3),
                scale: isOverTrash ? 1.16 : 1 + (trashProximity * 0.12),
              }}
              exit={{ opacity: 0, y: 30, scale: 0.9 }}
              className="absolute left-1/2 bottom-8 z-50 -translate-x-1/2 pointer-events-none"
            >
              <motion.div
                className={`min-w-[170px] rounded-2xl px-4 py-3 text-white text-xs font-bold shadow-2xl border transition-all duration-150 flex items-center justify-center gap-2 ${
                  isOverTrash
                    ? 'bg-red-600/95 border-red-300'
                    : 'bg-black/70 border-white/20'
                }`}
                animate={isOverTrash ? { rotate: [0, -4, 4, -3, 3, 0] } : { rotate: 0 }}
                transition={{ duration: 0.35 }}
              >
                <motion.div
                  animate={isOverTrash ? { scale: [1, 1.3, 1.08] } : { scale: 1 + (trashProximity * 0.2) }}
                  transition={{ duration: 0.25 }}
                >
                  <Trash2 className="w-4 h-4" />
                </motion.div>
                {isOverTrash ? 'Solte para excluir' : 'Arraste para a lixeira'}
              </motion.div>
              <motion.div
                className="absolute -inset-2 rounded-3xl border border-red-300/60"
                animate={{
                  opacity: isOverTrash ? 0.9 : 0.15 + (trashProximity * 0.45),
                  scale: isOverTrash ? 1.18 : 1 + (trashProximity * 0.16),
                }}
                transition={{ duration: 0.16 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top actions */}
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handlePublish}
            disabled={!file || uploading}
            className="px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-black disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? 'A publicar...' : 'Partilhar'}
          </button>
        </div>

        {/* Right toolbar */}
        <div className="absolute top-16 right-3 z-30 flex flex-col gap-2">
          <button
            onClick={() => setPanel((prev) => (prev === 'media' ? 'none' : 'media'))}
            className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
            title="Mover/zoom da mídia"
          >
            <Move className="w-5 h-5" />
          </button>
          <button
            onClick={onSelectMedia}
            className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
            title="Trocar mídia"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPanel((prev) => (prev === 'text' ? 'none' : 'text'))}
            className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
            title="Texto"
          >
            <Type className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPanel((prev) => (prev === 'stickers' ? 'none' : 'stickers'))}
            className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
            title="Sticker"
          >
            <Smile className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPanel((prev) => (prev === 'mentions' ? 'none' : 'mentions'))}
            className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
            title="Menção"
          >
            <AtSign className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPanel((prev) => (prev === 'music' ? 'none' : 'music'))}
            className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
            title="Música"
          >
            <Music2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPanel((prev) => (prev === 'location' ? 'none' : 'location'))}
            className="w-11 h-11 rounded-full bg-black/45 text-white flex items-center justify-center"
            title="Localização"
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="absolute left-4 right-4 bottom-24 z-30">
            <div className="bg-red-600/90 text-white text-xs font-semibold px-3 py-2 rounded-lg">{error}</div>
          </div>
        )}

        <AnimatePresence>
          {panel !== 'none' && (
            <motion.div
              initial={{ y: 260, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 260, opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 z-40 bg-[#111827]/95 backdrop-blur-md rounded-t-3xl p-4 border-t border-white/10"
            >
              {panel === 'media' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white text-sm font-black uppercase tracking-wider">Mídia</h4>
                    <button onClick={() => setPanel('none')} className="text-white/70">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-white/70 text-xs">
                    Use os dedos na tela para arrastar e pinçar (zoom) a foto/vídeo.
                  </p>
                  <button
                    onClick={() => setMediaTransform({ x: 0, y: 0, scale: 1 })}
                    className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-semibold"
                  >
                    Resetar posição/zoom
                  </button>
                </div>
              )}

              {panel === 'text' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white text-sm font-black uppercase tracking-wider">Texto</h4>
                    <button onClick={() => setPanel('none')} className="text-white/70">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Adiciona uma legenda..."
                    rows={3}
                    className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 p-3 text-sm focus:outline-none"
                  />
                  <div className="flex gap-2 overflow-x-auto">
                    {TEXT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setTextColor(color)}
                        className="w-8 h-8 rounded-full border-2 border-white/80 shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {FONT_OPTIONS.map((font) => (
                      <button
                        key={font.value}
                        onClick={() => setTextFont(font.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                          textFont === font.value ? 'bg-white text-slate-900' : 'bg-white/10 text-white'
                        }`}
                        style={{ fontFamily: font.value }}
                      >
                        {font.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-white/70 text-xs">Arraste/pinçe o texto diretamente na tela.</p>
                </div>
              )}

              {panel === 'stickers' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white text-sm font-black uppercase tracking-wider">Stickers</h4>
                    <button onClick={() => setPanel('none')} className="text-white/70">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {STICKER_OPTIONS.map((sticker) => (
                      <button
                        key={sticker}
                        onClick={() => handleAddSticker(sticker)}
                        className="h-10 rounded-lg bg-white/10 text-2xl flex items-center justify-center"
                      >
                        {sticker}
                      </button>
                    ))}
                  </div>
                  <p className="text-white/70 text-xs">Arraste/pinçe os stickers na tela para ajustar.</p>
                  {selectedSticker && (
                    <button
                      onClick={() => {
                        setStickers((prev) => prev.filter((item) => item.id !== selectedSticker.id));
                        setSelectedStickerId(null);
                      }}
                      className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-200 text-xs font-semibold"
                    >
                      Remover sticker selecionado
                    </button>
                  )}
                </div>
              )}

              {panel === 'mentions' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white text-sm font-black uppercase tracking-wider">Menções</h4>
                    <button onClick={() => setPanel('none')} className="text-white/70">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 w-4 h-4" />
                    <input
                      value={mentionQuery}
                      onChange={(e) => setMentionQuery(e.target.value)}
                      placeholder="Pesquisar utilizador..."
                      className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 py-2.5 pl-9 pr-3 text-sm focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && mentionQuery.trim()) {
                          e.preventDefault();
                          handleAddMention(mentionQuery);
                        }
                      }}
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {mentionResults.map((profile) => (
                      <button
                        key={profile.username}
                        onClick={() => handleAddMention(profile.username)}
                        className="w-full text-left text-sm text-white px-2 py-1.5 rounded-lg hover:bg-white/10 flex items-center gap-2"
                      >
                        <img
                          src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}`}
                          alt={profile.username}
                          className="w-8 h-8 rounded-full object-cover border border-white/20"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">@{profile.username}</p>
                          <p className="text-[11px] text-white/70 truncate">
                            {[profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || 'Usuário'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {mentionTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {mentionTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setMentionTags((prev) => prev.filter((item) => item !== tag))}
                          className="px-2.5 py-1 rounded-full bg-white/10 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          @{tag}
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-white/70 text-xs">Arraste/pinçe as menções na tela.</p>
                </div>
              )}

              {panel === 'music' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white text-sm font-black uppercase tracking-wider">Música</h4>
                    <button onClick={() => setPanel('none')} className="text-white/70">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 w-4 h-4" />
                    <input
                      value={musicQuery}
                      onChange={(e) => setMusicQuery(e.target.value)}
                      placeholder="Pesquisar música..."
                      className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 py-2.5 pl-9 pr-3 text-sm focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setMusicDisplayMode('album')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        musicDisplayMode === 'album' ? 'bg-white text-slate-900' : 'bg-white/10 text-white'
                      }`}
                    >
                      Ícone do álbum
                    </button>
                    <button
                      onClick={() => setMusicDisplayMode('lyrics')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                        musicDisplayMode === 'lyrics' ? 'bg-white text-slate-900' : 'bg-white/10 text-white'
                      }`}
                    >
                      Letra passando
                    </button>
                  </div>

                  {musicDisplayMode === 'lyrics' && (
                    <textarea
                      value={lyricsText}
                      onChange={(e) => setLyricsText(e.target.value)}
                      placeholder="Texto da letra/trecho que vai passar..."
                      rows={2}
                      className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 p-3 text-sm focus:outline-none"
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-white/70 text-xs">
                      {musicQuery.trim().length >= 2 ? 'Resultados da pesquisa' : 'Top indicadas do momento'}
                    </p>
                    <p className="text-white/60 text-[11px]">toque em ▶ para preview</p>
                  </div>

                  {favoriteTracks.length > 0 && musicQuery.trim().length < 2 && (
                    <div className="space-y-1">
                      <p className="text-white/70 text-xs font-semibold">Favoritas</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {favoriteTracks.slice(0, 8).map((track) => (
                          <div
                            key={`fav-${track.trackId}`}
                            className="w-full flex items-center gap-3 rounded-lg p-2 bg-white/10"
                          >
                            <button
                              onClick={() => toggleTrackPreview(track)}
                              className="w-9 h-9 rounded-full bg-black/40 border border-white/20 text-white flex items-center justify-center shrink-0"
                            >
                              {playingTrackId === track.trackId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            {track.artworkUrl100 ? (
                              <img src={track.artworkUrl100} alt={track.trackName} className="w-10 h-10 rounded-md object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center">
                                <Music2 className="w-4 h-4 text-white/70" />
                              </div>
                            )}
                            <button
                              onClick={() => handleSelectTrack(track)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="text-white text-xs font-semibold truncate">{track.trackName}</p>
                              <p className="text-white/70 text-[11px] truncate">{track.artistName}</p>
                            </button>
                            <button
                              onClick={() => { void handleRemoveFavoriteTrack(track.trackId); }}
                              className="text-amber-300 hover:text-amber-200"
                              title="Remover favorita"
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {musicLoading && <p className="text-white/70 text-xs">A pesquisar...</p>}
                    {tracksToDisplay.map((track) => (
                      <div
                        key={track.trackId}
                        className={`w-full flex items-center gap-3 rounded-lg p-2 ${
                          selectedMusic?.trackId === track.trackId ? 'bg-white/20' : 'hover:bg-white/10'
                        }`}
                      >
                        <button
                          onClick={() => toggleTrackPreview(track)}
                          className="w-9 h-9 rounded-full bg-black/40 border border-white/20 text-white flex items-center justify-center shrink-0"
                        >
                          {playingTrackId === track.trackId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        {track.artworkUrl100 ? (
                          <img src={track.artworkUrl100} alt={track.trackName} className="w-10 h-10 rounded-md object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center">
                            <Music2 className="w-4 h-4 text-white/70" />
                          </div>
                        )}
                        <button
                          onClick={() => handleSelectTrack(track)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-white text-xs font-semibold truncate">{track.trackName}</p>
                          <p className="text-white/70 text-[11px] truncate">{track.artistName}</p>
                        </button>
                        <button
                          onClick={() => { void handleSaveFavoriteTrack(track); }}
                          className="text-amber-300 hover:text-amber-200 shrink-0"
                          title="Salvar favorita"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              favoriteTracks.some((fav) => fav.trackId === track.trackId) ? 'fill-current' : ''
                            }`}
                          />
                        </button>
                        {selectedMusic?.trackId === track.trackId && <Check className="w-4 h-4 text-white shrink-0" />}
                      </div>
                    ))}
                  </div>

                  <p className="text-white/70 text-xs">Arraste/pinçe o bloco de música na tela.</p>
                </div>
              )}

              {panel === 'location' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white text-sm font-black uppercase tracking-wider">Localização</h4>
                    <button onClick={() => setPanel('none')} className="text-white/70">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 w-4 h-4" />
                    <input
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="Pesquisar locais..."
                      className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 py-2.5 pl-9 pr-3 text-sm focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleUseCurrentLocation}
                    className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Usar minha localização atual
                  </button>
                  {locationLoading && <p className="text-white/70 text-xs">Buscando locais...</p>}
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {locationSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        onClick={() => {
                          setLocationName(suggestion.label);
                          setLocationSuggestions([]);
                        }}
                        className="w-full text-left text-xs text-white px-2 py-2 rounded-lg hover:bg-white/10"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-white/70 text-xs">Arraste/pinçe a localização na tela.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  if (typeof document === 'undefined') return composerContent;
  return createPortal(composerContent, document.body);
}
