import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { StorySticker } from '../types';

type ComposerPanel = 'none' | 'text' | 'stickers' | 'mentions' | 'music' | 'location';

interface MusicTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  previewUrl?: string;
}

export interface StoryComposerPayload {
  caption?: string;
  textColor?: string;
  textFont?: string;
  locationName?: string;
  mentionTags?: string[];
  stickers?: StorySticker[];
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
  { x: 12, y: 22 },
  { x: 72, y: 20 },
  { x: 20, y: 38 },
  { x: 74, y: 40 },
  { x: 14, y: 58 },
  { x: 70, y: 60 },
];

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
  const [panel, setPanel] = useState<ComposerPanel>('none');
  const [caption, setCaption] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textFont, setTextFont] = useState('inherit');
  const [locationName, setLocationName] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<string[]>([]);
  const [mentionTags, setMentionTags] = useState<string[]>([]);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState<MusicTrack[]>([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);

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
    setMusicQuery('');
    setMusicResults([]);
    setSelectedMusic(null);
  }, [isOpen, file]);

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
        .select('username')
        .ilike('username', `%${query}%`)
        .limit(8);

      if (mentionError) {
        setMentionResults([]);
        return;
      }

      const usernames = (data || [])
        .map((profile: any) => profile.username)
        .filter(Boolean)
        .filter((username: string) => !mentionTags.includes(username));
      setMentionResults(usernames);
    }, 250);

    return () => clearTimeout(timeout);
  }, [isOpen, panel, mentionQuery, mentionTags]);

  useEffect(() => {
    if (!isOpen || panel !== 'music') return;
    const query = musicQuery.trim();
    if (query.length < 2) {
      setMusicResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setMusicLoading(true);
      try {
        const response = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=12`
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
  }, [isOpen, panel, musicQuery]);

  const handleAddMention = (username: string) => {
    const normalized = username.replace('@', '').trim();
    if (!normalized || mentionTags.includes(normalized)) return;
    setMentionTags((prev) => [...prev, normalized]);
    setMentionQuery('');
    setMentionResults([]);
  };

  const handleAddSticker = (label: string) => {
    const position = STICKER_POSITIONS[stickers.length % STICKER_POSITIONS.length];
    const sticker: StorySticker = {
      id: `${Date.now()}-${Math.random()}`,
      label,
      x: position.x,
      y: position.y,
    };
    setStickers((prev) => [...prev, sticker]);
  };

  const handlePublish = async () => {
    if (!file) return;
    await onPublish({
      caption: caption.trim() || undefined,
      textColor: textColor || undefined,
      textFont: textFont || undefined,
      locationName: locationName.trim() || undefined,
      mentionTags: mentionTags.length > 0 ? mentionTags : undefined,
      stickers: stickers.length > 0 ? stickers : undefined,
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

  if (!isOpen) return null;

  const composerContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-black"
    >
      <div className="relative w-full h-full overflow-hidden bg-black">
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

        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/45 pointer-events-none" />

        {selectedMusic && (
          <div className="absolute top-24 left-4 z-20 bg-black/55 text-white rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-2">
            <Music2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[220px]">
              {selectedMusic.trackName} {selectedMusic.artistName ? `- ${selectedMusic.artistName}` : ''}
            </span>
          </div>
        )}

        {locationName && (
          <div className="absolute top-36 left-4 z-20 bg-black/55 text-white rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate max-w-[200px]">{locationName}</span>
          </div>
        )}

        {mentionTags.length > 0 && (
          <div className="absolute top-48 left-4 right-4 z-20 flex flex-wrap gap-2">
            {mentionTags.map((tag) => (
              <span key={tag} className="bg-black/55 text-white text-xs font-semibold rounded-full px-2.5 py-1">
                @{tag}
              </span>
            ))}
          </div>
        )}

        {stickers.map((sticker) => (
          <div
            key={sticker.id}
            className="absolute z-20 text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]"
            style={{ left: `${sticker.x}%`, top: `${sticker.y}%` }}
          >
            {sticker.label}
          </div>
        ))}

        {caption && (
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 z-20 text-center pointer-events-none">
            <p
              className="text-3xl md:text-4xl font-black break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
              style={{ color: textColor, fontFamily: textFont }}
            >
              {caption}
            </p>
          </div>
        )}

        {/* Top actions */}
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between">
          <button
            onClick={onClose}
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

        {/* Bottom sheets */}
        <AnimatePresence>
          {panel !== 'none' && (
            <motion.div
              initial={{ y: 260, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 260, opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 z-40 bg-[#111827]/95 backdrop-blur-md rounded-t-3xl p-4 border-t border-white/10"
            >
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
                  {stickers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {stickers.map((sticker) => (
                        <button
                          key={sticker.id}
                          onClick={() => setStickers((prev) => prev.filter((item) => item.id !== sticker.id))}
                          className="px-2 py-1 rounded-full bg-white/10 text-white text-xs flex items-center gap-1"
                        >
                          {sticker.label}
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
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
                    {mentionResults.map((username) => (
                      <button
                        key={username}
                        onClick={() => handleAddMention(username)}
                        className="w-full text-left text-sm text-white px-2 py-1.5 rounded-lg hover:bg-white/10"
                      >
                        @{username}
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
                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {musicLoading && <p className="text-white/70 text-xs">A pesquisar...</p>}
                    {musicResults.map((track) => (
                      <button
                        key={track.trackId}
                        onClick={() => setSelectedMusic(track)}
                        className={`w-full flex items-center gap-3 text-left rounded-lg p-2 ${
                          selectedMusic?.trackId === track.trackId ? 'bg-white/20' : 'hover:bg-white/10'
                        }`}
                      >
                        {track.artworkUrl100 ? (
                          <img src={track.artworkUrl100} alt={track.trackName} className="w-10 h-10 rounded-md object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center">
                            <Music2 className="w-4 h-4 text-white/70" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-xs font-semibold truncate">{track.trackName}</p>
                          <p className="text-white/70 text-[11px] truncate">{track.artistName}</p>
                        </div>
                        {selectedMusic?.trackId === track.trackId && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
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
                      placeholder="Ex: Coimbra, Portugal"
                      className="w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 py-2.5 pl-9 pr-3 text-sm focus:outline-none"
                    />
                  </div>
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
