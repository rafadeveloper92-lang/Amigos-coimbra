import { supabase } from './supabaseClient';
import { Post, Group, Friend, Ad, Story } from '../types';

type StoryCommentRecord = {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_username?: string;
  author_avatar_url?: string;
};

type StoryInteractionState = {
  likesCount: number;
  isLiked: boolean;
  comments: StoryCommentRecord[];
};

type FavoriteTrackPayload = {
  trackId: number;
  trackName: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
};

const VIDEO_URL_PATTERN = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;

const inferPostMediaType = (url?: string | null, explicitType?: string | null): 'image' | 'video' => {
  if (explicitType === 'video' || explicitType === 'image') {
    return explicitType;
  }
  if (!url) return 'image';
  if (url.startsWith('data:video/') || VIDEO_URL_PATTERN.test(url)) {
    return 'video';
  }
  return 'image';
};

const resolvePostMediaUrl = (post: any) => (
  post.image || post.image_url || post.media_url || null
);

export const dataService = {
  async getStories(): Promise<Story[]> {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching stories:', error);
      return [];
    }

    const stories = (data || []) as Story[];
    if (stories.length === 0) return [];

    const userIds = Array.from(new Set(stories.map((story) => story.user_id).filter(Boolean)));
    if (userIds.length === 0) return stories;

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching story profiles:', profilesError);
      return stories;
    }

    const profileMap = new Map((profilesData || []).map((profile: any) => [profile.id, profile]));
    return stories.map((story) => ({
      ...story,
      profile: profileMap.get(story.user_id),
    }));
  },

  async createStory(story: Partial<Story>) {
    if (!story.user_id || !story.media_url || !story.media_type) {
      throw new Error('Dados obrigatórios do story ausentes.');
    }

    const baseStoryPayload = {
      user_id: story.user_id,
      media_url: story.media_url,
      media_type: story.media_type,
      expires_at: story.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const storyPayload = {
      ...baseStoryPayload,
      caption: story.caption || null,
      text_color: story.text_color || null,
      text_font: story.text_font || null,
      location_name: story.location_name || null,
      music_title: story.music_title || null,
      music_artist: story.music_artist || null,
      music_cover_url: story.music_cover_url || null,
      music_preview_url: story.music_preview_url || null,
      music_display_mode: story.music_display_mode || null,
      lyrics_text: story.lyrics_text || null,
      mention_tags: story.mention_tags || null,
      stickers: story.stickers || null,
      location_x: story.location_x ?? null,
      location_y: story.location_y ?? null,
      location_scale: story.location_scale ?? null,
      mention_x: story.mention_x ?? null,
      mention_y: story.mention_y ?? null,
      mention_scale: story.mention_scale ?? null,
      music_x: story.music_x ?? null,
      music_y: story.music_y ?? null,
      music_scale: story.music_scale ?? null,
      media_scale: story.media_scale ?? null,
      media_x: story.media_x ?? null,
      media_y: story.media_y ?? null,
      caption_x: story.caption_x ?? null,
      caption_y: story.caption_y ?? null,
      caption_scale: story.caption_scale ?? null,
    };

    const { data, error } = await supabase
      .from('stories')
      .insert([storyPayload])
      .select();
    if (error) {
      const canRetryWithBasePayload =
        error.code === 'PGRST204' ||
        error.message.toLowerCase().includes('column') ||
        error.message.toLowerCase().includes('schema cache');

      if (!canRetryWithBasePayload) throw error;

      const { data: retryData, error: retryError } = await supabase
        .from('stories')
        .insert([baseStoryPayload])
        .select();

      if (retryError) throw retryError;
      return retryData;
    }
    return data;
  },

  async deleteStory(storyId: string) {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (error) throw error;
    return true;
  },

  async getStoryInteractionState(storyId: string, viewerUserId?: string): Promise<StoryInteractionState> {
    const result: StoryInteractionState = {
      likesCount: 0,
      isLiked: false,
      comments: [],
    };

    const { data: reactionRows, error: reactionsError } = await supabase
      .from('story_reactions')
      .select('user_id')
      .eq('story_id', storyId);

    if (reactionsError) {
      console.error('Error fetching story reactions:', reactionsError);
    } else {
      const rows = reactionRows || [];
      result.likesCount = rows.length;
      result.isLiked = !!viewerUserId && rows.some((row: any) => row.user_id === viewerUserId);
    }

    const { data: commentsRows, error: commentsError } = await supabase
      .from('story_comments')
      .select('id, story_id, user_id, content, created_at')
      .eq('story_id', storyId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching story comments:', commentsError);
      return result;
    }

    const comments = (commentsRows || []) as StoryCommentRecord[];
    if (comments.length === 0) return result;

    const authorIds = Array.from(new Set(comments.map((comment) => comment.user_id).filter(Boolean)));
    if (authorIds.length === 0) {
      result.comments = comments;
      return result;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', authorIds);

    if (profileError) {
      console.error('Error fetching story comment profiles:', profileError);
      result.comments = comments;
      return result;
    }

    const profileMap = new Map((profileRows || []).map((profile: any) => [profile.id, profile]));
    result.comments = comments.map((comment) => {
      const profile = profileMap.get(comment.user_id);
      return {
        ...comment,
        author_username: profile?.username || 'Usuário',
        author_avatar_url: profile?.avatar_url || undefined,
      };
    });
    return result;
  },

  async setStoryLike(storyId: string, userId: string, like: boolean) {
    if (like) {
      const { data: existingLike } = await supabase
        .from('story_reactions')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .maybeSingle();

      const { error } = await supabase
        .from('story_reactions')
        .upsert([{ story_id: storyId, user_id: userId }], { onConflict: 'story_id,user_id' });
      if (error) throw error;

      // Notifica o dono do story apenas na primeira curtida do usuário.
      if (!existingLike?.id) {
        try {
          const { data: storyRow } = await supabase
            .from('stories')
            .select('user_id')
            .eq('id', storyId)
            .maybeSingle();

          const ownerId = (storyRow as any)?.user_id as string | undefined;
          if (ownerId && ownerId !== userId) {
            const likerProfile = await this.getUserProfile(userId);
            const likerName = likerProfile?.username
              || `${likerProfile?.first_name || ''} ${likerProfile?.last_name || ''}`.trim()
              || 'Alguém';

            await this.createNotification(
              ownerId,
              'like',
              `${likerName} curtiu seu story!`,
              { from_id: userId, link_to: 'feed', story_id: storyId }
            );
          }
        } catch (notifyError) {
          console.warn('Falha ao notificar curtida em story:', notifyError);
        }
      }
      return true;
    }

    const { error } = await supabase
      .from('story_reactions')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  },

  async addStoryComment(storyId: string, userId: string, content: string) {
    const value = content.trim();
    if (!value) return false;

    const { error } = await supabase
      .from('story_comments')
      .insert([{ story_id: storyId, user_id: userId, content: value }]);
    if (error) throw error;

    // Notifica o dono do story sobre novo comentário.
    try {
      const { data: storyRow } = await supabase
        .from('stories')
        .select('user_id')
        .eq('id', storyId)
        .maybeSingle();

      const ownerId = (storyRow as any)?.user_id as string | undefined;
      if (ownerId && ownerId !== userId) {
        const commenterProfile = await this.getUserProfile(userId);
        const commenterName = commenterProfile?.username
          || `${commenterProfile?.first_name || ''} ${commenterProfile?.last_name || ''}`.trim()
          || 'Alguém';

        await this.createNotification(
          ownerId,
          'comment',
          `${commenterName} comentou no seu story!`,
          { from_id: userId, link_to: 'feed', story_id: storyId }
        );
      }
    } catch (notifyError) {
      console.warn('Falha ao notificar comentário em story:', notifyError);
    }
    return true;
  },

  async getFavoriteTracks(userId: string): Promise<FavoriteTrackPayload[]> {
    const { data, error } = await supabase
      .from('favorite_tracks')
      .select('track_id, track_name, artist_name, artwork_url, preview_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      console.error('Error fetching favorite tracks:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      trackId: row.track_id,
      trackName: row.track_name,
      artistName: row.artist_name || undefined,
      artworkUrl100: row.artwork_url || undefined,
      previewUrl: row.preview_url || undefined,
    }));
  },

  async saveFavoriteTrack(userId: string, track: FavoriteTrackPayload) {
    if (!track.trackId || !track.trackName) return false;
    const { error } = await supabase
      .from('favorite_tracks')
      .upsert(
        [{
          user_id: userId,
          track_id: track.trackId,
          track_name: track.trackName,
          artist_name: track.artistName || null,
          artwork_url: track.artworkUrl100 || null,
          preview_url: track.previewUrl || null,
          created_at: new Date().toISOString(),
        }],
        { onConflict: 'user_id,track_id' }
      );

    if (error) throw error;
    return true;
  },

  async removeFavoriteTrack(userId: string, trackId: number) {
    const { error } = await supabase
      .from('favorite_tracks')
      .delete()
      .eq('user_id', userId)
      .eq('track_id', trackId);

    if (error) throw error;
    return true;
  },

  async uploadStoryMedia(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
    const filePath = `stories/${fileName}`;

    // Tenta primeiro o bucket "images" e faz fallback para "highlights"
    // (que costuma já estar configurado para upload de mídia no app).
    const candidateBuckets = ['images', 'highlights'] as const;
    for (const bucket of candidateBuckets) {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (!uploadError) {
        const { data } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        return data.publicUrl;
      }

      console.error(`Error uploading story media to bucket "${bucket}":`, uploadError);
    }

    return null;
  },

  async getAds(): Promise<Ad[]> {
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ads:', error);
      return [];
    }
    return data || [];
  },

  async createAd(ad: Partial<Ad>) {
    const { data, error } = await supabase
      .from('ads')
      .insert([ad])
      .select();
    if (error) throw error;
    return data;
  },

  async updateAd(id: number, ad: Partial<Ad>) {
    const { data, error } = await supabase
      .from('ads')
      .update(ad)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data;
  },

  async deleteAd(id: number) {
    const { error } = await supabase
      .from('ads')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async uploadAdImage(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `ads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading ad image:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  async getPosts(): Promise<Post[]> {
    const { data: userData } = await supabase.auth.getUser();
    const currentUser = userData?.user;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    let userReactions: Record<number, string> = {};
    if (currentUser) {
      const { data: reactions } = await supabase
        .from('post_reactions')
        .select('post_id, reaction_type')
        .eq('user_id', currentUser.id);
      
      if (reactions) {
        reactions.forEach(r => {
          userReactions[r.post_id] = r.reaction_type;
        });
      }
    }

    if (error) {
      console.error('Error fetching posts:', error);
      // Fallback to simple select if join fails (e.g., user_id column missing)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (fallbackError) return [];
      return (fallbackData || []).map(post => ({
        ...post,
        image: resolvePostMediaUrl(post) || undefined,
        media_type: inferPostMediaType(resolvePostMediaUrl(post), (post as any).media_type),
        time: new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ago',
        is_news: post.is_news || false,
        userReaction: userReactions[post.id] || null
      }));
    }
    
    // Map Supabase fields to our component props
    return (data || []).map(post => {
      const profile = (post as any).profiles;
      const authorName = profile 
        ? (profile.username || `${profile.first_name || ''} ${profile.last_name || ''}`.trim()) 
        : post.author;

      return {
        ...post,
        image: resolvePostMediaUrl(post) || undefined,
        media_type: inferPostMediaType(resolvePostMediaUrl(post), (post as any).media_type),
        author: authorName || 'Usuário',
        author_avatar: profile?.avatar_url || null,
        time: new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ago',
        is_news: post.is_news || false,
        userReaction: userReactions[post.id] || null
      };
    });
  },

  async getPostById(postId: number): Promise<Post | null> {
    const { data: userData } = await supabase.auth.getUser();
    const currentUser = userData?.user;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          username,
          avatar_url
        )
      `)
      .eq('id', postId)
      .single();

    if (error || !data) {
      console.error('Error fetching post by id:', error);
      return null;
    }

    let userReaction = null;
    if (currentUser) {
      const { data: reaction } = await supabase
        .from('post_reactions')
        .select('reaction_type')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();
      
      if (reaction) {
        userReaction = reaction.reaction_type;
      }
    }

    const profile = (data as any).profiles;
    const authorName = profile 
      ? (profile.username || `${profile.first_name || ''} ${profile.last_name || ''}`.trim()) 
      : data.author;

    return {
      ...data,
      image: resolvePostMediaUrl(data) || undefined,
      media_type: inferPostMediaType(resolvePostMediaUrl(data), (data as any).media_type),
      author: authorName || 'Usuário',
      author_avatar: profile?.avatar_url || null,
      time: new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ago',
      is_news: data.is_news || false,
      userReaction: userReaction
    };
  },

  async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  },

  async updateUserProfile(userId: string, updates: any) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  async getProfileStats(userId: string) {
    try {
      // Posts count
      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      // Followers count
      const { count: followersCount, error: followersError } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', userId)
        .eq('status', 'accepted');
        
      // Following count
      const { count: followingCount, error: followingError } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (postsError || followersError || followingError) {
        console.error('Error fetching stats:', postsError || followersError || followingError);
      }

      return {
        posts_count: postsCount || 0,
        followers_count: followersCount || 0,
        following_count: followingCount || 0
      };
    } catch (error) {
      console.error('Error fetching profile stats:', error);
      return { posts_count: 0, followers_count: 0, following_count: 0 };
    }
  },

  async getUserPosts(userId: string): Promise<Post[]> {
    const { data: userData } = await supabase.auth.getUser();
    const currentUser = userData?.user;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          username,
          avatar_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    let userReactions: Record<number, string> = {};
    if (currentUser) {
      const { data: reactions } = await supabase
        .from('post_reactions')
        .select('post_id, reaction_type')
        .eq('user_id', currentUser.id);
      
      if (reactions) {
        reactions.forEach(r => {
          userReactions[r.post_id] = r.reaction_type;
        });
      }
    }

    if (error) {
      console.error('Error fetching user posts:', error);
      return [];
    }
    
    return (data || []).map(post => {
      const profile = (post as any).profiles;
      const authorName = profile 
        ? (profile.username || `${profile.first_name || ''} ${profile.last_name || ''}`.trim()) 
        : post.author;

      return {
        ...post,
        image: resolvePostMediaUrl(post) || undefined,
        media_type: inferPostMediaType(resolvePostMediaUrl(post), (post as any).media_type),
        author: authorName || 'Usuário',
        author_avatar: profile?.avatar_url || null,
        time: new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ago',
        is_news: post.is_news || false,
        userReaction: userReactions[post.id] || null
      };
    });
  },

  async getGroups(): Promise<Group[]> {
    const { data, error } = await supabase
      .from('groups')
      .select('*');

    if (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
    return data || [];
  },

  async getFavoriteGroups(userId: string): Promise<number[]> {
    const { data, error } = await supabase
      .from('favorite_groups')
      .select('group_id')
      .eq('user_id', userId);
      
    if (error) {
      console.error('Erro ao buscar grupos favoritos:', error);
      return [];
    }
    return data.map(f => f.group_id);
  },

  async toggleFavoriteGroup(userId: string, groupId: number, isFavorite: boolean) {
    
    if (isFavorite) {
      // Remove favorite
      const { error } = await supabase
        .from('favorite_groups')
        .delete()
        .eq('user_id', userId)
        .eq('group_id', groupId);
      if (error) throw error;
    } else {
      // Add favorite
      const { error } = await supabase
        .from('favorite_groups')
        .insert([{ user_id: userId, group_id: groupId }]);
      if (error) throw error;
    }
    return true;
  },

  async updateLastSeen(userId: string) {
    if (!userId) return;
    try {
      await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating last_seen:', error);
    }
  },

  async getFriends(): Promise<Friend[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      // Fetch accepted friendships
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          status,
          user_id,
          friend_id,
          profiles:friend_id (id, first_name, last_name, avatar_url, username, updated_at),
          user_profiles:user_id (id, first_name, last_name, avatar_url, username, updated_at)
        `)
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (error) {
        if (error.message.includes('relation "public.friendships" does not exist')) {
          // Fallback to 'friends' table
          const { data: friendsData } = await supabase.from('friends').select('*');
          return friendsData || [];
        }
        throw error;
      }

      return (data || []).map(f => {
        const isOtherUserFriend = f.user_id === user.id;
        const profile = isOtherUserFriend ? (f as any).profiles : (f as any).user_profiles;
        
        // Calculate status based on updated_at
        let status: 'Online' | 'Offline' | 'Idle' = 'Offline';
        if (profile?.updated_at) {
          const lastSeenDate = new Date(profile.updated_at);
          const now = new Date();
          const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
          
          if (diffInMinutes < 5) {
            status = 'Online';
          } else if (diffInMinutes < 15) {
            status = 'Idle';
          }
        }

        return {
          id: profile?.id || (isOtherUserFriend ? f.friend_id : f.user_id),
          name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username : 'Usuário',
          avatar_url: profile?.avatar_url || null,
          status: status
        };
      });
    } catch (error) {
      console.error('Error fetching friends:', error);
      return [];
    }
  },

  async getPendingFriendRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { incoming: [], outgoing: [] };

    try {
      // Use a more robust join syntax
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          status,
          user_id,
          friend_id,
          profiles!friend_id (id, first_name, last_name, avatar_url, username),
          user_profiles:profiles!user_id (id, first_name, last_name, avatar_url, username)
        `)
        .eq('status', 'pending')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (error) {
        console.error('Supabase error in getPendingFriendRequests:', error);
        throw error;
      }

      console.log('Pending requests data:', data);

      const incoming = (data || []).filter(f => f.friend_id === user.id).map(f => {
        const profile = (f as any).user_profiles;
        return {
          friendshipId: f.id,
          id: f.user_id,
          name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || 'Usuário' : 'Usuário',
          avatar_url: profile?.avatar_url || null
        };
      });

      const outgoing = (data || []).filter(f => f.user_id === user.id).map(f => {
        const profile = (f as any).profiles;
        return {
          friendshipId: f.id,
          id: f.friend_id,
          name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || 'Usuário' : 'Usuário',
          avatar_url: profile?.avatar_url || null
        };
      });

      return { incoming, outgoing };
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      return { incoming: [], outgoing: [] };
    }
  },

  async acceptFriendRequest(friendshipId: number) {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return false;
    }
  },

  async declineFriendRequest(friendshipId: number) {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error declining friend request:', error);
      return false;
    }
  },

  async addFriend(userId: string, friendId: string) {
    console.log('dataService.addFriend:', userId, friendId);
    try {
      // First, check if a friendship already exists
      const { data: existing, error: checkError } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .maybeSingle();

      if (checkError && !checkError.message.includes('relation "public.friendships" does not exist')) {
        throw checkError;
      }

      if (existing) {
        console.log('Friendship already exists:', existing);
        return existing;
      }

      // Try inserting into 'friendships' table
      const { data, error } = await supabase
        .from('friendships')
        .insert([{ user_id: userId, friend_id: friendId, status: 'pending' }])
        .select();
        
      if (error) {
        console.warn('Error inserting into friendships, trying friends table:', error.message);
        // Fallback to 'friends' table if 'friendships' doesn't exist
        const { data: friendsData, error: friendsError } = await supabase
          .from('friends')
          .insert([{ user_id: userId, friend_id: friendId, status: 'pending' }])
          .select();
        
        if (friendsError) {
          console.error('Erro fatal ao adicionar amigo:', friendsError);
          throw friendsError;
        }
        
        // Create notification for the friend
        console.log('Criando notificação de pedido de amizade (fallback)...');
        await this.createNotification(friendId, 'friend_request', 'Você recebeu um novo pedido de amizade!', { from_id: userId, link_to: 'friends' });
        
        return friendsData && friendsData.length > 0 ? friendsData[0] : friendsData;
      }

      // Create notification for the friend
      console.log('DEBUG: Criando notificação de pedido de amizade...');
      const senderProfile = await this.getUserProfile(userId);
      const senderName = senderProfile ? `${senderProfile.first_name} ${senderProfile.last_name}` : 'Alguém';
      await this.createNotification(friendId, 'friend_request', `${senderName} enviou um novo pedido de amizade!`, { from_id: userId, link_to: 'friends' });

      return data && data.length > 0 ? data[0] : data;
    } catch (error: any) {
      console.error('Error adding friend:', error);
      return null;
    }
  },

  async getFriendshipStatus(userId: string, friendId: string) {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .maybeSingle();
      
      if (error && !error.message.includes('relation "public.friendships" does not exist')) throw error;
      return data;
    } catch (error) {
      console.error('Error getting friendship status:', error);
      return null;
    }
  },

  async removeFriend(userId: string, friendId: string) {
    try {
      const { error: error1 } = await supabase
        .from('friendships')
        .delete()
        .match({ user_id: userId, friend_id: friendId });
        
      const { error: error2 } = await supabase
        .from('friendships')
        .delete()
        .match({ user_id: friendId, friend_id: userId });
      
      if (error1) throw error1;
      if (error2) throw error2;
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      return false;
    }
  },

  async blockUser(userId: string, blockedId: string) {
    try {
      // Delete any existing friendship in both directions first
      await this.removeFriend(userId, blockedId);
      
      // Insert a new record where user_id = blocker, friend_id = blocked, status = 'blocked'
      const { error } = await supabase
        .from('friendships')
        .insert([{ user_id: userId, friend_id: blockedId, status: 'blocked' }]);
        
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      return false;
    }
  },

  async getNotifications(userId: string) {
    console.log('DEBUG: dataService.getNotifications called for:', userId);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('DEBUG: Supabase error in getNotifications:', error);
        if (!error.message.includes('relation "public.notifications" does not exist')) throw error;
      }
      
      console.log('DEBUG: dataService.getNotifications data:', data);
      return data || [];
    } catch (error) {
      console.error('DEBUG: Error fetching notifications:', error);
      return [];
    }
  },

  async createNotification(userId: string, type: string, content: string, metadata: any = {}) {
    console.log('DEBUG: dataService.createNotification call:', { userId, type, content, metadata });
    try {
      // First try with all columns
      let { data, error } = await supabase
        .from('notifications')
        .insert([{ 
          user_id: userId, 
          type, 
          content, 
          from_user_id: metadata.from_id || null,
          link_to: metadata.link_to || null,
          is_read: false 
        }])
        .select();
      
      if (error) {
        console.error('DEBUG: Erro do Supabase ao criar notificação (tentativa 1):', error);
        
        // Fallback: try without from_user_id and link_to in case the table is old
        console.log('DEBUG: Tentando fallback sem colunas extras...');
        const fallback = await supabase
          .from('notifications')
          .insert([{ 
            user_id: userId, 
            type, 
            content, 
            is_read: false 
          }])
          .select();
          
        data = fallback.data;
        error = fallback.error;
        
        if (error) {
           console.error('DEBUG: Erro fatal no fallback de notificação:', error);
           return null;
        }
      }
      console.log('DEBUG: Notificação criada com sucesso:', data);
      return data;
    } catch (error) {
      console.error('DEBUG: Erro de rede ao criar notificação:', error);
      return null;
    }
  },

  async markNotificationAsRead(notificationId: number) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  async createGroup(group: Partial<Group>) {
    const { data, error } = await supabase
      .from('groups')
      .insert([group])
      .select();
    if (error) throw error;
    return data;
  },

  async updateGroup(id: number, group: Partial<Group>) {
    const { data, error } = await supabase
      .from('groups')
      .update(group)
      .eq('id', id)
      .select();
    if (error) throw error;
    return data;
  },

  async updateGroupLastRead(groupId: number, userId: string) {
    try {
      const { error } = await supabase
        .from('group_last_read')
        .upsert(
          { group_id: groupId, user_id: userId, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id,group_id' }
        );
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating last read:', error);
      return false;
    }
  },

  async getUnreadMessagesCount(groupId: number, userId: string) {
    try {
      // Get last read timestamp
      const { data: lastReadData, error: lastReadError } = await supabase
        .from('group_last_read')
        .select('last_read_at')
        .match({ group_id: groupId, user_id: userId })
        .single();

      if (lastReadError && lastReadError.code !== 'PGRST116') throw lastReadError;

      const lastReadAt = lastReadData?.last_read_at || new Date(0).toISOString();

      // Count messages after that timestamp
      const { count, error: countError } = await supabase
        .from('group_messages')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .gt('created_at', lastReadAt);

      if (countError) throw countError;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  async deleteGroup(id: number) {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async joinGroup(groupId: number, userId: string | undefined) {
    if (!userId) return false;
    
    try {
      // Tenta inserir na tabela group_members (vai falhar se já existir devido ao UNIQUE)
      const { error: insertError } = await supabase
        .from('group_members')
        .insert([{ group_id: groupId, user_id: userId }]);
        
      if (insertError) {
        // Se o erro for de duplicidade (já é membro), apenas retorna
        if (insertError.code === '23505') return true;
        throw insertError;
      }

      // Se inseriu com sucesso, atualiza a contagem de membros no grupo
      // Pega a contagem atual
      const { count, error: countError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);
        
      if (!countError && count !== null) {
        const membersText = count === 1 ? '1 membro' : `${count} membros`;
        await supabase
          .from('groups')
          .update({ members_count: membersText })
          .eq('id', groupId);
      }
      
      return true;
    } catch (error) {
      console.error('Error joining group:', error);
      return false;
    }
  },

  async leaveGroup(groupId: number, userId: string | undefined) {
    if (!userId) return false;
    
    try {
      const { error: deleteError } = await supabase
        .from('group_members')
        .delete()
        .match({ group_id: groupId, user_id: userId });
        
      if (deleteError) throw deleteError;

      // Atualiza a contagem de membros no grupo
      const { count, error: countError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);
        
      if (!countError && count !== null) {
        const membersText = count === 1 ? '1 membro' : `${count} membros`;
        await supabase
          .from('groups')
          .update({ members_count: membersText })
          .eq('id', groupId);
      }
      
      return true;
    } catch (error) {
      console.error('Error leaving group:', error);
      return false;
    }
  },

  async getGroupMembersProfiles(groupId: number) {
    try {
      // 1. Fetch member IDs first
      // Tentamos buscar com role, se falhar, buscamos sem role
      let members;
      let membersError;
      
      const resWithRole = await supabase
        .from('group_members')
        .select('user_id, joined_at, role')
        .eq('group_id', groupId);
        
      if (resWithRole.error) {
        // Fallback para tabela sem a coluna role ou em caso de erro
        console.warn('Error fetching with role, trying without role:', resWithRole.error);
        const resWithoutRole = await supabase
          .from('group_members')
          .select('user_id, joined_at')
          .eq('group_id', groupId);
          
        if (resWithoutRole.error) {
          console.warn('Error fetching with joined_at, trying just user_id:', resWithoutRole.error);
          const resJustUserId = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);
            
          members = resJustUserId.data;
          membersError = resJustUserId.error;
        } else {
          members = resWithoutRole.data;
          membersError = resWithoutRole.error;
        }
      } else {
        members = resWithRole.data;
        membersError = resWithRole.error;
      }
        
      if (membersError) throw membersError;
      
      // If no members found in the database, generate dummy members based on members_count
      if (!members || members.length === 0) {
        // Fetch the group to get members_count
        const { data: groupData } = await supabase
          .from('groups')
          .select('members_count')
          .eq('id', groupId)
          .single();
          
        const countMatch = groupData?.members_count?.match(/\d+/);
        const count = countMatch ? parseInt(countMatch[0], 10) : 1;
        
        return Array.from({ length: count }).map((_, i) => ({
          id: `dummy-${groupId}-${i}`,
          first_name: `Membro`,
          last_name: `${i + 1}`,
          avatar_url: `https://picsum.photos/seed/group-${groupId}-member-${i}/100/100`,
          joined_at: new Date().toISOString(),
          role: i === 0 ? 'admin' : 'member'
        }));
      }
      
      const userIds = members.map(m => m.user_id);
      
      // 2. Fetch profiles for these users
      let profiles;
      let profilesError;
      
      const resProfiles = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);
        
      if (resProfiles.error) {
        // Fallback para buscar apenas o id e avatar_url se first_name/last_name não existirem
        const resProfilesFallback = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', userIds);
          
        profiles = resProfilesFallback.data;
        profilesError = resProfilesFallback.error;
      } else {
        profiles = resProfiles.data;
        profilesError = resProfiles.error;
      }
        
      if (profilesError) {
        console.warn('Error fetching profiles, using fallback names', profilesError);
        profiles = [];
      }
      
      // 3. Map them together
      return members.map(member => {
        const profile = profiles?.find(p => p.id === member.user_id);
        return {
          id: member.user_id,
          first_name: profile?.first_name || 'Usuário',
          last_name: profile?.last_name || '',
          avatar_url: profile?.avatar_url,
          joined_at: member.joined_at,
          role: member.role || 'member'
        };
      });
    } catch (error) {
      console.error('Error fetching group members:', error);
      return [];
    }
  },

  async banMember(groupId: number, userId: string) {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .match({ group_id: groupId, user_id: userId });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error banning member:', error);
      return false;
    }
  },

  async promoteMember(groupId: number, userId: string) {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'admin' })
        .match({ group_id: groupId, user_id: userId });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error promoting member:', error);
      return false;
    }
  },

  async getDirectMessages(userId1: string, userId2: string) {
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      return [];
    }
  },

  async sendDirectMessage(senderId: string, receiverId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) return null;
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert([{
          sender_id: senderId,
          receiver_id: receiverId,
          content: trimmed
        }])
        .select()
        .single();
        
      if (error) {
        console.error('Supabase error sending DM:', error);
        throw error;
      }

      // Notificação não pode quebrar o envio da mensagem.
      try {
        const senderProfile = await this.getUserProfile(senderId);
        const senderName = senderProfile ? `${senderProfile.first_name} ${senderProfile.last_name}` : 'Alguém';
        await this.createNotification(receiverId, 'message', `${senderName} enviou uma nova mensagem privada!`, { from_id: senderId, link_to: 'messages' });
      } catch (notifyError) {
        console.warn('Falha ao criar notificação de DM:', notifyError);
      }

      return data;
    } catch (error: any) {
      console.error('Error sending direct message:', error);
      return null;
    }
  },

  async getGroupMessages(groupId: number) {
    const { data, error } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching group messages:', error);
      return [];
    }
    return data || [];
  },

  async sendGroupMessage(groupId: number, userId: string | undefined, authorName: string, content: string) {
    const { error } = await supabase
      .from('group_messages')
      .insert([{ group_id: groupId, user_id: userId, author_name: authorName, content }]);
    
    if (error) throw error;
    return true;
  },

  async createPost(post: Partial<Post>) {
    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData?.user?.id;
    const ownerId = post.user_id || authUserId;
    if (!ownerId) {
      throw new Error('Usuário não autenticado para criar post.');
    }

    const payload = {
      ...post,
      user_id: ownerId,
      media_type: post.media_type || undefined,
    };

    const { data, error } = await supabase
      .from('posts')
      .insert([payload])
      .select();

    if (error) {
      const isColumnOrSchemaError =
        error.code === 'PGRST204' ||
        error.message.toLowerCase().includes('column') ||
        error.message.toLowerCase().includes('schema cache');

      if (error.message.toLowerCase().includes('row-level security policy')) {
        throw new Error('Permissão de RLS negada na tabela posts. Rode o SQL fix_posts_rls.sql no Supabase.');
      }

      // Se o erro for coluna inexistente, tenta postar sem colunas opcionais.
      if (error.message.includes('user_id') || isColumnOrSchemaError) {
        const { user_id, media_type, ...postWithoutOptionalColumns } = payload as any;
        const { data: retryData, error: retryError } = await supabase
          .from('posts')
          .insert([postWithoutOptionalColumns])
          .select();
        
        if (retryError) throw retryError;
        return retryData;
      }
      throw error;
    }
    return data;
  },

  async uploadGroupCover(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `group-covers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading group cover:', uploadError);
      if (uploadError.message.includes('bucket not found')) {
        console.warn('Bucket "images" not found. Please create it in Supabase Storage.');
      }
      return null;
    }

    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  async uploadImage(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
    const mediaFolder = file.type.startsWith('video') ? 'post-videos' : 'post-images';
    const filePath = `${mediaFolder}/${fileName}`;
    const candidateBuckets = ['images', 'highlights'] as const;

    for (const bucket of candidateBuckets) {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (!uploadError) {
        const { data } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        return data.publicUrl;
      }

      console.error(`Error uploading post media to bucket "${bucket}":`, uploadError);
    }

    return null;
  },

  async likePost(postId: number, reactionType: string = 'like', userId?: string) {
    if (userId) {
      const { error: rpcError } = await supabase.rpc('add_post_reaction', {
        p_post_id: postId,
        p_user_id: userId,
        p_reaction_type: reactionType
      });
      
      if (!rpcError) {
        // Create notification for the post author
        const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
        if (post?.user_id && post.user_id !== userId) {
          const likerProfile = await this.getUserProfile(userId);
          const likerName = likerProfile ? `${likerProfile.first_name} ${likerProfile.last_name}` : 'Alguém';
          const reactionText = reactionType === 'like' ? 'curtiu' : 'reagiu ao';
          await this.createNotification(post.user_id, 'like', `${likerName} ${reactionText} seu post!`, { from_id: userId, link_to: `post_${postId}` });
        }
        return true;
      }
    }

    // Fallback to old logic if RPC fails or userId is missing
    const { data: post } = await supabase
      .from('posts')
      .select('likes, reaction_counts, user_id')
      .eq('id', postId)
      .single();
    
    const currentLikes = post?.likes || 0;
    const currentCounts = post?.reaction_counts || {};
    
    const newCounts = { ...currentCounts };
    newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
    
    const { data, error } = await supabase
      .from('posts')
      .update({ 
        likes: currentLikes + 1,
        reaction_counts: newCounts
      })
      .eq('id', postId)
      .select();
    
    if (error) {
      const { data: fallbackData, error: fallbackError } = await supabase.rpc('increment_likes', { post_id: postId });
      if (fallbackError || !fallbackData) {
        const { error: finalError } = await supabase.from('posts').update({ likes: currentLikes + 1 }).eq('id', postId);
        if (finalError) throw finalError;
      }
    }

    if (post?.user_id && userId && post.user_id !== userId) {
      const likerProfile = await this.getUserProfile(userId);
      const likerName = likerProfile ? `${likerProfile.first_name} ${likerProfile.last_name}` : 'Alguém';
      const reactionText = reactionType === 'like' ? 'curtiu' : 'reagiu ao';
      await this.createNotification(post.user_id, 'like', `${likerName} ${reactionText} seu post!`, { from_id: userId, link_to: `post_${postId}` });
    }
    
    return data;
  },

  async unlikePost(postId: number, reactionType: string = 'like', userId?: string) {
    if (userId) {
      const { error: rpcError } = await supabase.rpc('remove_post_reaction', {
        p_post_id: postId,
        p_user_id: userId
      });
      
      if (!rpcError) {
        return true;
      }
    }

    // Fallback to old logic
    const { data: post } = await supabase
      .from('posts')
      .select('likes, reaction_counts')
      .eq('id', postId)
      .single();
    
    const currentLikes = post?.likes || 0;
    const currentCounts = post?.reaction_counts || {};
    
    const newCounts = { ...currentCounts };
    newCounts[reactionType] = Math.max(0, (newCounts[reactionType] || 0) - 1);
    
    const { data, error } = await supabase
      .from('posts')
      .update({ 
        likes: Math.max(0, currentLikes - 1),
        reaction_counts: newCounts
      })
      .eq('id', postId)
      .select();
    
    if (error) {
      const { error: finalError } = await supabase.from('posts').update({ likes: Math.max(0, currentLikes - 1) }).eq('id', postId);
      if (finalError) throw finalError;
    }
    
    return data;
  },

  async commentPost(postId: number, author: string, content: string, userId?: string) {
    
    // 1. Add the comment to the comments table
    const { error: commentError } = await supabase
      .from('comments')
      .insert([{ post_id: postId, author, content, user_id: userId }]);
      
    if (commentError) {
      // Se falhar por causa do user_id, tenta sem ele
      if (commentError.message.includes('user_id')) {
        await supabase
          .from('comments')
          .insert([{ post_id: postId, author, content }]);
      } else {
        console.warn('Comments table error:', commentError.message);
      }
    }

    // 2. Increment the comment count in the posts table
    const { data: currentPost } = await supabase.from('posts').select('comments, user_id').eq('id', postId).single();
    const newComments = (currentPost?.comments || 0) + 1;
    await supabase.from('posts').update({ comments: newComments }).eq('id', postId);

    // 3. Create notification for the post author
    if (currentPost?.user_id && userId && currentPost.user_id !== userId) {
      const commenterProfile = await this.getUserProfile(userId);
      const commenterName = commenterProfile ? `${commenterProfile.first_name} ${commenterProfile.last_name}` : author;
      await this.createNotification(currentPost.user_id, 'comment', `${commenterName} comentou no seu post!`, { from_id: userId, link_to: `post_${postId}` });
    }

    return true;
  },

  async getComments(postId: number): Promise<Comment[]> {
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id || null;

    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          username,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      // Fallback
      const { data: fallbackData } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      return fallbackData || [];
    }

    const normalized = (data || []).map(comment => {
      const profile = (comment as any).profiles;
      const authorName = profile 
        ? (profile.username || `${profile.first_name || ''} ${profile.last_name || ''}`.trim()) 
        : comment.author;

      return {
        ...comment,
        author: authorName || 'Usuário',
        author_avatar: profile?.avatar_url || null
      };
    });

    if (normalized.length === 0) {
      return normalized;
    }

    const commentIds = normalized.map((comment) => comment.id);
    let likesRows: Array<{ comment_id: number; user_id?: string | null }> = [];

    const { data: likesData, error: likesError } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', commentIds);

    if (likesError) {
      // Não quebra o carregamento de comentários caso a tabela/políticas ainda não existam.
      console.warn('comment_likes indisponível, retornando comentários sem likes:', likesError.message);
    } else {
      likesRows = (likesData || []) as Array<{ comment_id: number; user_id?: string | null }>;
    }

    const likesCountByComment = likesRows.reduce<Record<number, number>>((acc, row) => {
      const key = Number(row.comment_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const likedByMeSet = new Set<number>(
      likesRows
        .filter((row) => !!currentUserId && row.user_id === currentUserId)
        .map((row) => Number(row.comment_id))
    );

    return normalized.map((comment) => ({
      ...comment,
      likes_count: likesCountByComment[comment.id] || 0,
      liked_by_me: likedByMeSet.has(comment.id),
    }));
  },

  async toggleCommentLike(commentId: number, userId?: string): Promise<{ liked: boolean; likes_count: number } | null> {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;

    const { data: existingLike, error: existingError } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', uid)
      .maybeSingle();

    if (existingError && !existingError.message.toLowerCase().includes('no rows')) {
      console.error('Erro ao verificar like de comentário:', existingError);
      throw existingError;
    }

    let liked = false;
    if (existingLike?.id) {
      const { error: deleteError } = await supabase
        .from('comment_likes')
        .delete()
        .eq('id', existingLike.id);
      if (deleteError) throw deleteError;
      liked = false;
    } else {
      const { error: insertError } = await supabase
        .from('comment_likes')
        .insert([{ comment_id: commentId, user_id: uid }]);
      if (insertError) throw insertError;
      liked = true;
    }

    const { count, error: countError } = await supabase
      .from('comment_likes')
      .select('id', { count: 'exact', head: true })
      .eq('comment_id', commentId);

    if (countError) throw countError;

    return {
      liked,
      likes_count: count || 0,
    };
  },

  async deletePost(postId: number) {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (error) throw error;
    return true;
  },

  async checkConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      // Tenta buscar apenas um registro de qualquer tabela para validar a conexão
      const { error } = await supabase.from('posts').select('id').limit(1);
      if (error) {
        // Se o erro for que a tabela não existe, a conexão está ok, mas o banco está vazio/sem esquema
        const isTableMissing = 
          error.code === 'PGRST116' || 
          error.message.includes('relation "public.posts" does not exist') ||
          error.message.toLowerCase().includes('could not find the table');

        if (isTableMissing) {
          return { connected: true, message: 'Conectado (Sem tabelas)' };
        }
        // Erro de autenticação ou chave inválida
        if (error.code === '401' || error.message.includes('JWT')) {
          return { connected: false, message: 'Chave Inválida' };
        }
        return { connected: false, message: `Erro: ${error.message}` };
      }
      return { connected: true, message: 'Conectado' };
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        return { connected: false, message: 'URL Inválida ou Offline' };
      }
      return { connected: false, message: 'Erro de rede' };
    }
  },

  async getHighlights(userId: string) {
    const { data, error } = await supabase
      .from('highlights')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching highlights:', error);
      return [];
    }
    return data || [];
  },

  async createHighlight(userId: string, title: string, cover_url: string) {
    const { data, error } = await supabase
      .from('highlights')
      .insert([{ user_id: userId, title, cover_url }])
      .select();
    if (error) throw error;
    return data;
  },

  async updateHighlight(highlightId: string, title: string, cover_url: string) {
    const { data, error } = await supabase
      .from('highlights')
      .update({ title, cover_url })
      .eq('id', highlightId)
      .select();
    if (error) throw error;
    return data;
  },

  async getHighlightItems(highlightId: string) {
    const { data, error } = await supabase
      .from('highlight_items')
      .select('*')
      .eq('highlight_id', highlightId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async addHighlightItem(highlightId: string, image_url: string) {
    const { data, error } = await supabase
      .from('highlight_items')
      .insert([{ highlight_id: highlightId, image_url }])
      .select();
    if (error) throw error;
    return data;
  },

  async deleteHighlightItem(itemId: string) {
    console.log('Tentando excluir item:', itemId);
    const { error } = await supabase
      .from('highlight_items')
      .delete()
      .eq('id', itemId);
    if (error) {
      console.error('Erro ao excluir do Supabase:', error);
      throw error;
    }
    console.log('Item excluído com sucesso!');
  }
};
