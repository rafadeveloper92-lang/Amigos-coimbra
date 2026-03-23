import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Users, Volume2, VolumeX, Shield, UserMinus, Plus } from 'lucide-react';
import { Profile } from '../types';

const MAX_VOICE_PER_CHANNEL = 6;

interface VoiceChannelProps {
  groupId: number;
  profile: Profile;
  isAdmin?: boolean;
  groupCreatorId?: string;
}

interface RemoteUser {
  socketId: string;
  profile: Profile;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

type ChannelRow = { id: string; name: string };

export default function VoiceChannel({ groupId, profile, isAdmin, groupCreatorId }: VoiceChannelProps) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, RemoteUser>>({});
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [channels, setChannels] = useState<ChannelRow[]>([{ id: 'default', name: 'Geral' }]);
  const [selectedChannelId, setSelectedChannelId] = useState('default');
  const [roomCount, setRoomCount] = useState(0);
  const [newChannelName, setNewChannelName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteUsersRef = useRef<Record<string, RemoteUser>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalysersRef = useRef<Record<string, AnalyserNode>>({});
  const animationFrameRef = useRef<number | null>(null);
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});
  const activeChannelIdRef = useRef<string>('default');
  const selectedChannelIdRef = useRef<string>('default');
  const roomCountPollRef = useRef<number | null>(null);

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const startVolumeDetection = (stream: MediaStream) => {
    try {
      const audioContext = getAudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setIsSpeaking(average > 15);
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.error('Error starting volume detection:', e);
    }
  };

  const startRemoteVolumeDetection = (socketId: string, stream: MediaStream) => {
    try {
      const audioContext = getAudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      remoteAnalysersRef.current[socketId] = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!remoteAnalysersRef.current[socketId]) return;
        remoteAnalysersRef.current[socketId].getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setRemoteSpeaking((prev) => ({ ...prev, [socketId]: average > 15 }));
        requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.error('Error starting remote volume detection:', e);
    }
  };

  const stopVolumeDetection = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    analyserRef.current = null;
    remoteAnalysersRef.current = {};
    setIsSpeaking(false);
    setRemoteSpeaking({});
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const requestRoomCount = useCallback((channelId: string) => {
    return new Promise<number>((resolve) => {
      const s = socketRef.current;
      if (!s) {
        resolve(0);
        return;
      }
      const handler = (data: { groupId: string; channelId: string; count: number }) => {
        if (String(data.groupId) === String(groupId) && data.channelId === channelId) {
          s.off('voice-room-count', handler);
          resolve(data.count);
        }
      };
      s.on('voice-room-count', handler);
      s.emit('get-voice-room-count', { groupId, channelId });
      setTimeout(() => {
        s.off('voice-room-count', handler);
        resolve(0);
      }, 3000);
    });
  }, [groupId]);

  const createPeerConnection = (remoteSocketId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', { to: remoteSocketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      remoteUsersRef.current[remoteSocketId] = {
        ...remoteUsersRef.current[remoteSocketId],
        stream,
      };
      setRemoteUsers({ ...remoteUsersRef.current });
      startRemoteVolumeDetection(remoteSocketId, stream);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  };

  const leaveVoiceInternal = () => {
    stopVolumeDetection();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    (Object.values(remoteUsersRef.current) as RemoteUser[]).forEach((user) => {
      if (user.peerConnection) {
        user.peerConnection.close();
      }
    });

    socketRef.current?.emit('leave-voice', {
      groupId,
      channelId: activeChannelIdRef.current,
    });
    remoteUsersRef.current = {};
    setRemoteUsers({});
    setIsInVoice(false);
  };

  useEffect(() => {
    socketRef.current = io(window.location.origin, { transports: ['websocket', 'polling'] });
    const socket = socketRef.current;

    socket.emit('join-voice-meta', { groupId });

    socket.on('voice-channels-list', ({ channels: list }: { channels: ChannelRow[] }) => {
      if (Array.isArray(list) && list.length) setChannels(list);
    });

    socket.on('voice-room-count', (data: { groupId: string; channelId: string; count: number }) => {
      if (String(data.groupId) !== String(groupId)) return;
      if (data.channelId === selectedChannelIdRef.current) {
        setRoomCount(data.count);
      }
    });

    socket.on('voice-join-error', (payload: { code?: string; message?: string }) => {
      if (payload?.code === 'FULL') {
        setError(payload.message || 'Canal cheio. Crie outro canal.');
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
        setIsInVoice(false);
        stopVolumeDetection();
      }
    });

    socket.on('user-joined-voice', ({ socketId, profile: userProfile }: { socketId: string; profile: Profile }) => {
      remoteUsersRef.current[socketId] = {
        socketId,
        profile: userProfile,
      };
      setRemoteUsers({ ...remoteUsersRef.current });
    });

    socket.on('current-voice-users', async (users: { socketId: string; profile: Profile }[]) => {
      const newUsers: Record<string, RemoteUser> = {};
      users.forEach((user) => {
        newUsers[user.socketId] = {
          socketId: user.socketId,
          profile: user.profile,
        };
      });
      remoteUsersRef.current = newUsers;
      setRemoteUsers({ ...remoteUsersRef.current });

      for (const user of users) {
        try {
          const pc = createPeerConnection(user.socketId);
          remoteUsersRef.current[user.socketId] = {
            ...remoteUsersRef.current[user.socketId],
            peerConnection: pc,
          };
          setRemoteUsers({ ...remoteUsersRef.current });
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: user.socketId, offer });
        } catch (e) {
          console.error('Erro ao criar oferta WebRTC para', user.socketId, e);
        }
      }
    });

    socket.on('offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(from);
      remoteUsersRef.current[from] = {
        ...remoteUsersRef.current[from],
        peerConnection: pc,
      };
      setRemoteUsers({ ...remoteUsersRef.current });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { to: from, answer });
    });

    socket.on('answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = remoteUsersRef.current[from]?.peerConnection;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = remoteUsersRef.current[from]?.peerConnection;
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('user-left-voice', (socketId: string) => {
      const user = remoteUsersRef.current[socketId];
      if (user?.peerConnection) {
        user.peerConnection.close();
      }
      delete remoteUsersRef.current[socketId];
      setRemoteUsers({ ...remoteUsersRef.current });
    });

    socket.on('muted-by-admin', ({ mute }: { mute: boolean }) => {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !mute;
          setIsMuted(mute);
        }
      }
    });

    socket.on('kicked-by-admin', () => {
      leaveVoiceInternal();
      setError('Você foi removido do canal de voz pelo administrador.');
    });

    return () => {
      leaveVoiceInternal();
      socket.emit('leave-voice-meta', { groupId });
      socket.disconnect();
    };
  }, [groupId]);

  useEffect(() => {
    if (!socketRef.current || isInVoice) return;
    const tick = () => {
      socketRef.current?.emit('get-voice-room-count', { groupId, channelId: selectedChannelId });
    };
    tick();
    roomCountPollRef.current = window.setInterval(tick, 2500);
    return () => {
      if (roomCountPollRef.current) {
        clearInterval(roomCountPollRef.current);
        roomCountPollRef.current = null;
      }
    };
  }, [groupId, selectedChannelId, isInVoice]);

  const createChannel = () => {
    const name = newChannelName.trim() || `Canal ${channels.length}`;
    socketRef.current?.emit('create-voice-channel', { groupId, name });
    setNewChannelName('');
    setShowCreateInput(false);
  };

  const joinVoice = async () => {
    if (isConnecting || isInVoice) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Seu navegador não suporta chat de voz ou o site não está em ambiente seguro (HTTPS).');
      return;
    }

    const channelId = selectedChannelId;
    const count = await requestRoomCount(channelId);
    if (count >= MAX_VOICE_PER_CHANNEL) {
      setError(
        `Este canal está cheio (${MAX_VOICE_PER_CHANNEL}/${MAX_VOICE_PER_CHANNEL}). Crie outro canal abaixo.`,
      );
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (e) {
        console.warn('High quality audio failed, falling back to simple audio:', e);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      localStreamRef.current = stream;
      activeChannelIdRef.current = channelId;
      setIsInVoice(true);
      startVolumeDetection(stream);

      socketRef.current?.emit('join-voice', { groupId, channelId, profile });
    } catch (err: any) {
      console.error('Error joining voice:', err);
      const errName = err.name || '';
      const errMsg = err.message || '';

      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.toLowerCase().includes('denied')
      ) {
        setError(
          'Acesso ao microfone negado. Por favor, clique no ícone de cadeado na barra de endereços e permita o microfone para este site.',
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setError('Nenhum microfone encontrado. Verifique se o seu dispositivo está conectado e funcionando.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setError('O microfone está sendo usado por outro aplicativo ou aba. Feche-os e tente novamente.');
      } else {
        setError(`Erro ao acessar microfone: ${errMsg || 'Erro desconhecido'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const leaveVoice = () => {
    leaveVoiceInternal();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const adminMuteUser = (targetSocketId: string, mute: boolean) => {
    socketRef.current?.emit('admin-mute-user', {
      groupId,
      channelId: activeChannelIdRef.current,
      targetSocketId,
      mute,
    });
  };

  const adminKickUser = (targetSocketId: string) => {
    socketRef.current?.emit('admin-kick-user', {
      groupId,
      channelId: activeChannelIdRef.current,
      targetSocketId,
    });
  };

  const selectedName = channels.find((c) => c.id === selectedChannelId)?.name ?? 'Canal';
  const isFull = roomCount >= MAX_VOICE_PER_CHANNEL;
  const canJoin = !isFull && !isInVoice;

  return (
    <div className="bg-slate-900 rounded-3xl p-4 shadow-xl mb-6 border border-white/10 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 border border-purple-500/30">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-tighter">Canais de Voz</h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isInVoice ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {isInVoice ? `Conectado · ${selectedName}` : 'Desconectado'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInVoice && (
            <button
              onClick={toggleMute}
              className={`p-2.5 rounded-xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={isMuted ? 'Desmutar' : 'Mutar'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {!isInVoice ? (
            <button
              onClick={joinVoice}
              disabled={isConnecting || !canJoin}
              className="bg-purple-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isConnecting ? 'Conectando...' : 'Entrar'}
            </button>
          ) : (
            <button
              onClick={leaveVoice}
              className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
            >
              Sair
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 text-red-400 text-[11px] font-bold rounded-2xl border border-red-500/20 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div className="flex gap-2">
              <Shield className="w-4 h-4 shrink-0" />
              <p className="leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white text-lg leading-none">
              &times;
            </button>
          </div>

          {(error.includes('negado') || error.includes('permissão')) && (
            <div className="flex flex-col gap-2">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest">
                Dica: Clique no cadeado na barra de endereços para resetar as permissões.
              </p>
              <button
                onClick={joinVoice}
                className="bg-red-500 text-white py-2 rounded-xl text-[10px] uppercase font-black tracking-widest hover:bg-red-600 transition-all shadow-lg active:scale-95"
              >
                Tentar Novamente / Pedir Permissão
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
          <span>Canal ativo</span>
          <span className="text-[10px] text-slate-400">
            {roomCount}/{MAX_VOICE_PER_CHANNEL} {isFull ? '· Cheio' : ''}
          </span>
        </div>
        <select
          value={selectedChannelId}
          disabled={isInVoice}
          onChange={(e) => setSelectedChannelId(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-60"
        >
          {channels.map((c) => (
            <option key={c.id} value={c.id} className="bg-slate-900">
              {c.name}
            </option>
          ))}
        </select>
        {isInVoice && (
          <p className="text-[9px] text-amber-400/90">Saia do canal para trocar de sala.</p>
        )}

        {!isInVoice && isFull && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-100">
            <span className="font-bold">Canal cheio.</span> Crie outro canal abaixo para continuar.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {!showCreateInput ? (
            <button
              type="button"
              onClick={() => setShowCreateInput(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-white/20 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5 hover:border-purple-500/40 transition-colors"
            >
              <Plus className="w-4 h-4" /> Criar novo canal de voz
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Nome do canal (ex.: Sala 2)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createChannel}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateInput(false);
                    setNewChannelName('');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 text-[10px] font-black uppercase text-slate-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">
          <span>Membros neste canal</span>
          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
            <Users className="w-2.5 h-2.5" /> {Object.keys(remoteUsers).length + (isInVoice ? 1 : 0)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
          {isInVoice && (
            <div
              className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-300 ${isSpeaking ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={
                      profile.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.first_name || 'U')}&background=random`
                    }
                    alt={profile.first_name}
                    className={`w-8 h-8 rounded-full border-2 object-cover transition-all duration-300 ${isSpeaking ? 'border-green-500 scale-110' : 'border-purple-500/30'}`}
                  />
                  {!isMuted && isSpeaking && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full flex items-center justify-center">
                      <div className="w-1 h-1 bg-white rounded-full animate-ping"></div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white">
                      {profile.first_name} <span className="text-[9px] text-slate-500">(Você)</span>
                    </p>
                    {isAdmin && (
                      <span className="bg-purple-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-tighter">
                        <Shield className="w-2 h-2" /> Admin
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[9px] font-black uppercase tracking-widest ${isMuted ? 'text-red-400' : isSpeaking ? 'text-green-400' : 'text-slate-500'}`}
                  >
                    {isMuted ? 'Silenciado' : isSpeaking ? 'Falando...' : 'Conectado'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(Object.values(remoteUsers) as RemoteUser[]).map((user) => {
            const isRemoteSpeaking = remoteSpeaking[user.socketId];
            return (
              <div
                key={user.socketId}
                className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-300 group ${isRemoteSpeaking ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={
                        user.profile.avatar_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.profile.first_name || 'U')}&background=random`
                      }
                      alt={user.profile.first_name}
                      className={`w-8 h-8 rounded-full border-2 object-cover transition-all duration-300 ${isRemoteSpeaking ? 'border-green-500 scale-110' : 'border-white/10'}`}
                    />
                    {user.stream && isRemoteSpeaking && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full flex items-center justify-center">
                        <div className="w-1 h-1 bg-white rounded-full animate-ping"></div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white">{user.profile.first_name}</p>
                      {groupCreatorId === user.profile.id && (
                        <span className="bg-purple-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-tighter">
                          <Shield className="w-2 h-2" /> Admin
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[9px] font-black uppercase tracking-widest ${isRemoteSpeaking ? 'text-green-400' : 'text-slate-500'}`}
                    >
                      {isRemoteSpeaking ? 'Falando...' : 'Conectado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => adminMuteUser(user.socketId, true)}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Silenciar Usuário"
                      >
                        <MicOff className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => adminKickUser(user.socketId)}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Expulsar Usuário"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {user.stream ? (
                    <div
                      className={`p-1.5 rounded-lg ${isRemoteSpeaking ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-slate-400'}`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <audio
                        autoPlay
                        ref={(el) => {
                          if (el && user.stream) el.srcObject = user.stream;
                        }}
                        style={{ display: 'none' }}
                      />
                    </div>
                  ) : (
                    <div className="p-1.5 bg-white/5 text-slate-600 rounded-lg">
                      <VolumeX className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!isInVoice && Object.keys(remoteUsers).length === 0 && (
            <div className="py-6 text-center">
              <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Ninguém neste canal</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
