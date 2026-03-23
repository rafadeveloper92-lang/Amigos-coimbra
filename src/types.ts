export interface Profile {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  city?: string;
  nationality?: string;
  occupation?: string;
  relationship?: string;
  birthdate?: string;
  gender?: string;
  role?: string;
  updated_at?: string;
  posts_count?: number;
  followers_count?: number;
  following_count?: number;
}

export interface Post {
  id: number;
  user_id?: string;
  author: string;
  author_avatar?: string;
  group?: string;
  time: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  reaction_counts?: Record<string, number>;
  is_news: boolean;
  userReaction?: string | null;
}

export interface Comment {
  id: number;
  post_id: number;
  user_id?: string;
  author: string;
  author_avatar?: string;
  content: string;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  members_count: string;
  icon_name: string;
  color: string;
  password?: string;
  cover_url?: string;
  is_sales?: boolean;
  is_jobs?: boolean;
  is_voice?: boolean;
  created_by?: string;
  is_official?: boolean;
}

export interface Friend {
  id: string | number;
  name: string;
  status: 'Online' | 'Offline' | 'Idle';
  avatar_url?: string;
}

export interface Notification {
  id: number;
  user_id: string;
  type: 'friend_request' | 'message' | 'system';
  content: string;
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

export interface Friendship {
  id: number;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  title: string;
  cover_url: string;
  created_at: string;
}

export interface HighlightItem {
  id: string;
  highlight_id: string;
  image_url: string;
  created_at: string;
}

export interface Ad {
  id: number;
  title: string;
  description: string;
  image_url: string;
  link_url?: string;
  location?: string;
  phone?: string;
  created_at?: string;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  text_color?: string;
  text_font?: string;
  location_name?: string;
  music_title?: string;
  music_artist?: string;
  music_cover_url?: string;
  music_preview_url?: string;
  mention_tags?: string[];
  stickers?: StorySticker[];
  created_at: string;
  expires_at: string;
  profile?: Profile;
}

export interface StorySticker {
  id: string;
  label: string;
  x: number;
  y: number;
}
