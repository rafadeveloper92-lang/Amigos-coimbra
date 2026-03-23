import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, PhoneOff, Users, Volume2, VolumeX, Shield, Trash2, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile } from '../types';

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

export default function VoiceChannel({ groupId, profile, isAdmin, groupCreatorId }: VoiceChannelProps) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, RemoteUser>>({});
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteUsersRef = useRef<Record<string, RemoteUser>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalysersRef = useRef<Record<string, AnalyserNode>>({});
  const animationFrameRef = useRef<number | null>(null);
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

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
        setRemoteSpeaking(prev => ({ ...prev, [socketId]: average > 15 }));
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

  useEffect(() => {
    // Mesmo host da página (evita ligar a outro servidor por engano)
    socketRef.current = io(window.location.origin, { transports: ['websocket', 'polling'] });

    // Quem já estava na sala: só atualiza a lista — NÃO envia oferta aqui.
    // Quem acabou de entrar envia ofertas em `current-voice-users` (evita "salas" WebRTC duplicadas / glare).
    socketRef.current.on('user-joined-voice', ({ socketId, profile: userProfile }) => {
      console.log('User joined voice:', socketId);
      remoteUsersRef.current[socketId] = {
        socketId,
        profile: userProfile,
      };
      setRemoteUsers({ ...remoteUsersRef.current });
    });

    socketRef.current.on('current-voice-users', async (users: { socketId: string, profile: Profile }[]) => {
      console.log('Current voice users:', users);
      const newUsers: Record<string, RemoteUser> = {};
      users.forEach(user => {
        newUsers[user.socketId] = {
          socketId: user.socketId,
          profile: user.profile
        };
      });
      remoteUsersRef.current = newUsers;
      setRemoteUsers({ ...remoteUsersRef.current });

      // Joiner: negocia com todos os que já estavam na sala (única origem de ofertas ao entrar)
      for (const user of users) {
        try {
          const pc = createPeerConnection(user.socketId);
          remoteUsersRef.current[user.socketId] = {
            ...remoteUsersRef.current[user.socketId],
            peerConnection: pc
          };
          setRemoteUsers({ ...remoteUsersRef.current });
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('offer', { to: user.socketId, offer });
        } catch (e) {
          console.error('Erro ao criar oferta WebRTC para', user.socketId, e);
        }
      }
    });

    socketRef.current.on('offer', async ({ from, offer }) => {
      console.log('Received offer from:', from);
      const pc = createPeerConnection(from);
      remoteUsersRef.current[from] = {
        ...remoteUsersRef.current[from],
        peerConnection: pc
      };
      setRemoteUsers({ ...remoteUsersRef.current });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('answer', { to: from, answer });
    });

    socketRef.current.on('answer', async ({ from, answer }) => {
      console.log('Received answer from:', from);
      const pc = remoteUsersRef.current[from]?.peerConnection;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socketRef.current.on('ice-candidate', async ({ from, candidate }) => {
      console.log('Received ICE candidate from:', from);
      const pc = remoteUsersRef.current[from]?.peerConnection;
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socketRef.current.on('user-left-voice', (socketId: string) => {
      console.log('User left voice:', socketId);
      const user = remoteUsersRef.current[socketId];
      if (user?.peerConnection) {
        user.peerConnection.close();
      }
      delete remoteUsersRef.current[socketId];
      setRemoteUsers({ ...remoteUsersRef.current });
    });

    // Admin event listeners
    socketRef.current.on('muted-by-admin', ({ mute }: { mute: boolean }) => {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !mute;
          setIsMuted(mute);
        }
      }
    });

    socketRef.current.on('kicked-by-admin', () => {
      leaveVoice();
      setError('Você foi removido do canal de voz pelo administrador.');
    });

    return () => {
      leaveVoice();
      socketRef.current?.disconnect();
    };
  }, []);

  const createPeerConnection = (socketId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', { to: socketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track from:', socketId);
      const stream = event.streams[0];
      remoteUsersRef.current[socketId] = {
        ...remoteUsersRef.current[socketId],
        stream
      };
      setRemoteUsers({ ...remoteUsersRef.current });
      startRemoteVolumeDetection(socketId, stream);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  };

  const joinVoice = async () => {
    if (isConnecting || isInVoice) return;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Seu navegador não suporta chat de voz ou o site não está em ambiente seguro (HTTPS).');
      return;
    }

    setIsConnecting(true);
    setError(null);
    
    try {
      let stream: MediaStream;
      try {
        // Try with high quality constraints first
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      } catch (e) {
        console.warn('High quality audio failed, falling back to simple audio:', e);
        // Fallback to simple audio if constraints are not supported
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      localStreamRef.current = stream;
      setIsInVoice(true);
      startVolumeDetection(stream);
      
      socketRef.current?.emit('join-voice', { groupId, profile });
    } catch (err: any) {
      console.error('Error joining voice:', err);
      const errName = err.name || '';
      const errMsg = err.message || '';
      
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMsg.toLowerCase().includes('denied')) {
        setError('Acesso ao microfone negado. Por favor, clique no ícone de cadeado na barra de endereços e permita o microfone para este site.');
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
    stopVolumeDetection();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    (Object.values(remoteUsersRef.current) as RemoteUser[]).forEach(user => {
      if (user.peerConnection) {
        user.peerConnection.close();
      }
    });

    socketRef.current?.emit('leave-voice', { groupId });
    remoteUsersRef.current = {};
    setRemoteUsers({});
    setIsInVoice(false);
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
    socketRef.current?.emit('admin-mute-user', { groupId, targetSocketId, mute });
  };

  const adminKickUser = (targetSocketId: string) => {
    socketRef.current?.emit('admin-kick-user', { groupId, targetSocketId });
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-4 shadow-xl mb-6 border border-white/10 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 border border-purple-500/30">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-tighter">Canal de Voz</h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isInVoice ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {isInVoice ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isInVoice && (
            <button
              onClick={toggleMute}
              className={`p-2.5 rounded-xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={isMuted ? "Desmutar" : "Mutar"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          
          {!isInVoice ? (
            <button
              onClick={joinVoice}
              disabled={isConnecting}
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
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white text-lg leading-none">&times;</button>
          </div>
          
          {(error.includes('negado') || error.includes('permissão')) && (
            <div className="flex flex-col gap-2">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest">Dica: Clique no cadeado na barra de endereços para resetar as permissões.</p>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">
          <span>Membros Conectados</span>
          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
            <Users className="w-2.5 h-2.5" /> {Object.keys(remoteUsers).length + (isInVoice ? 1 : 0)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
          {/* Local User */}
          {isInVoice && (
            <div className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-300 ${isSpeaking ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5'}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.first_name || 'U')}&background=random`} 
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
                    <p className="text-xs font-bold text-white">{profile.first_name} <span className="text-[9px] text-slate-500">(Você)</span></p>
                    {isAdmin && (
                      <span className="bg-purple-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-tighter">
                        <Shield className="w-2 h-2" /> Admin
                      </span>
                    )}
                  </div>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${isMuted ? 'text-red-400' : isSpeaking ? 'text-green-400' : 'text-slate-500'}`}>
                    {isMuted ? 'Silenciado' : isSpeaking ? 'Falando...' : 'Conectado'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Remote Users */}
          {(Object.values(remoteUsers) as RemoteUser[]).map(user => {
            const isRemoteSpeaking = remoteSpeaking[user.socketId];
            return (
              <div key={user.socketId} className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-300 group ${isRemoteSpeaking ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5'}`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src={user.profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.profile.first_name || 'U')}&background=random`} 
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
                    <p className={`text-[9px] font-black uppercase tracking-widest ${isRemoteSpeaking ? 'text-green-400' : 'text-slate-500'}`}>
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
                    <div className={`p-1.5 rounded-lg ${isRemoteSpeaking ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-slate-400'}`}>
                      <Volume2 className="w-3.5 h-3.5" />
                      <audio 
                        autoPlay 
                        ref={el => { if (el && user.stream) el.srcObject = user.stream; }} 
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
              <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Ninguém no canal</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
