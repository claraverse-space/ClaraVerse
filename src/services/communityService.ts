import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for TypeScript
export interface CommunityUser {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  github_username?: string;
  website_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CommunityResource {
  id: string;
  title: string;
  description: string;
  category: 'mcp-server' | 'prompt' | 'custom-node' | 'wallpaper' | 'workflow' | 'tutorial' | 'tool' | 'template';
  subcategory?: string;
  tags: string[];
  version: string;
  github_url?: string;
  download_url?: string;
  thumbnail_url?: string;
  demo_url?: string;
  content?: string;
  content_type?: string;
  author_id: string;
  author_username: string;
  downloads_count: number;
  likes_count: number;
  views_count: number;
  status: 'published' | 'draft' | 'removed';
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceLike {
  id: string;
  resource_id: string;
  user_id: string;
  created_at: string;
}

export interface ResourceComment {
  id: string;
  resource_id: string;
  author_id: string;
  author_username: string;
  content: string;
  parent_id?: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

// Local user management (guest user system)
export class LocalUserManager {
  private static USER_KEY = 'claraverse_community_user';
  private static USERNAME_KEY = 'claraverse_community_username';

  static getCurrentUser(): { id: string; username: string } | null {
    try {
      const userId = localStorage.getItem(this.USER_KEY);
      const username = localStorage.getItem(this.USERNAME_KEY);
      
      if (userId && username) {
        return { id: userId, username };
      }
      return null;
    } catch {
      return null;
    }
  }

  static setCurrentUser(id: string, username: string): void {
    localStorage.setItem(this.USER_KEY, id);
    localStorage.setItem(this.USERNAME_KEY, username);
  }

  static clearCurrentUser(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
  }

  static hasUser(): boolean {
    return this.getCurrentUser() !== null;
  }
}

// Community Service Class
export class CommunityService {
  // User Management
  static async createUser(userData: {
    username: string;
    display_name?: string;
    bio?: string;
    github_username?: string;
    website_url?: string;
  }): Promise<CommunityUser> {
    const { data, error } = await supabase
      .from('community_users')
      .insert([userData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    // Store user locally
    LocalUserManager.setCurrentUser(data.id, data.username);
    
    return data;
  }

  static async checkUsernameAvailable(username: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('community_users')
      .select('id')
      .eq('username', username)
      .single();

    if (error && error.code === 'PGRST116') {
      // No rows returned, username is available
      return true;
    }

    return false;
  }

  static async getUserByUsername(username: string): Promise<CommunityUser | null> {
    const { data, error } = await supabase
      .from('community_users')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  static async updateUser(userId: string, updates: Partial<CommunityUser>): Promise<CommunityUser> {
    const { data, error } = await supabase
      .from('community_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data;
  }

  // Resource Management
  static async createResource(resourceData: {
    title: string;
    description: string;
    category: CommunityResource['category'];
    subcategory?: string;
    tags: string[];
    version?: string;
    github_url?: string;
    download_url?: string;
    thumbnail_url?: string;
    demo_url?: string;
    content?: string;
    content_type?: string;
  }): Promise<CommunityResource> {
    const currentUser = LocalUserManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('Must be logged in to create resources');
    }

    const { data, error } = await supabase
      .from('community_resources')
      .insert([{
        ...resourceData,
        author_id: currentUser.id,
        author_username: currentUser.username,
        version: resourceData.version || '1.0.0'
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create resource: ${error.message}`);
    }

    return data;
  }

  static async getResources(filters?: {
    category?: string;
    search?: string;
    author?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'recent' | 'popular' | 'downloads';
  }): Promise<CommunityResource[]> {
    let query = supabase
      .from('community_resources')
      .select('*')
      .eq('status', 'published');

    // Apply filters
    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    if (filters?.author) {
      query = query.eq('author_username', filters.author);
    }

    if (filters?.featured) {
      query = query.eq('featured', true);
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    // Apply sorting
    switch (filters?.sortBy) {
      case 'popular':
        query = query.order('likes_count', { ascending: false });
        break;
      case 'downloads':
        query = query.order('downloads_count', { ascending: false });
        break;
      case 'recent':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch resources: ${error.message}`);
    }

    return data || [];
  }

  static async getResourceById(id: string): Promise<CommunityResource | null> {
    const { data, error } = await supabase
      .from('community_resources')
      .select('*')
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (error) {
      return null;
    }

    // Increment view count
    await this.incrementViews(id);

    return data;
  }

  static async updateResource(id: string, updates: Partial<CommunityResource>): Promise<CommunityResource> {
    const currentUser = LocalUserManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('Must be logged in to update resources');
    }

    // Verify ownership
    const resource = await this.getResourceById(id);
    if (!resource || resource.author_id !== currentUser.id) {
      throw new Error('Can only update your own resources');
    }

    const { data, error } = await supabase
      .from('community_resources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update resource: ${error.message}`);
    }

    return data;
  }

  static async deleteResource(id: string): Promise<void> {
    const currentUser = LocalUserManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('Must be logged in to delete resources');
    }

    // Verify ownership
    const { data: resource } = await supabase
      .from('community_resources')
      .select('author_id')
      .eq('id', id)
      .single();

    if (!resource || resource.author_id !== currentUser.id) {
      throw new Error('Can only delete your own resources');
    }

    const { error } = await supabase
      .from('community_resources')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete resource: ${error.message}`);
    }
  }

  // Engagement Actions
  static async toggleLike(resourceId: string): Promise<{ liked: boolean; likesCount: number }> {
    const currentUser = LocalUserManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('Must be logged in to like resources');
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('resource_likes')
      .select('id')
      .eq('resource_id', resourceId)
      .eq('user_id', currentUser.id)
      .single();

    if (existingLike) {
      // Remove like
      await supabase
        .from('resource_likes')
        .delete()
        .eq('id', existingLike.id);
      
      // Decrement likes count using RPC function
      await supabase.rpc('decrement_likes', { resource_uuid: resourceId });
    } else {
      // Add like
      await supabase
        .from('resource_likes')
        .insert([{
          resource_id: resourceId,
          user_id: currentUser.id
        }]);
      
      // Increment likes count using RPC function
      await supabase.rpc('increment_likes', { resource_uuid: resourceId });
    }

    // Get updated likes count
    const { data: resource } = await supabase
      .from('community_resources')
      .select('likes_count')
      .eq('id', resourceId)
      .single();

    return {
      liked: !existingLike,
      likesCount: resource?.likes_count || 0
    };
  }

  static async checkUserLikes(resourceIds: string[]): Promise<Set<string>> {
    const currentUser = LocalUserManager.getCurrentUser();
    if (!currentUser || resourceIds.length === 0) {
      return new Set();
    }

    const { data, error } = await supabase
      .from('resource_likes')
      .select('resource_id')
      .eq('user_id', currentUser.id)
      .in('resource_id', resourceIds);

    if (error) {
      console.error('Error checking user likes:', error);
      return new Set();
    }

    return new Set(data.map(like => like.resource_id));
  }

  static async incrementDownloads(resourceId: string): Promise<void> {
    const currentUser = LocalUserManager.getCurrentUser();
    
    // Track download
    await supabase
      .from('resource_downloads')
      .insert([{
        resource_id: resourceId,
        user_id: currentUser?.id || null
      }]);

    // Increment downloads count
    await supabase.rpc('increment_downloads', { resource_uuid: resourceId });
  }

  static async incrementViews(resourceId: string): Promise<void> {
    const currentUser = LocalUserManager.getCurrentUser();
    
    // Track view
    await supabase
      .from('resource_views')
      .insert([{
        resource_id: resourceId,
        user_id: currentUser?.id || null
      }]);

    // Increment views count
    await supabase.rpc('increment_views', { resource_uuid: resourceId });
  }

  // Comments
  static async getComments(resourceId: string): Promise<ResourceComment[]> {
    const { data, error } = await supabase
      .from('resource_comments')
      .select('*')
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    return data || [];
  }

  static async createComment(resourceId: string, content: string, parentId?: string): Promise<ResourceComment> {
    const currentUser = LocalUserManager.getCurrentUser();
    if (!currentUser) {
      throw new Error('Must be logged in to comment');
    }

    const { data, error } = await supabase
      .from('resource_comments')
      .insert([{
        resource_id: resourceId,
        author_id: currentUser.id,
        author_username: currentUser.username,
        content,
        parent_id: parentId
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create comment: ${error.message}`);
    }

    return data;
  }

  // Statistics
  static async getCommunityStats(): Promise<{
    totalResources: number;
    totalUsers: number;
    totalDownloads: number;
    totalLikes: number;
  }> {
    const [resources, users, downloads, likes] = await Promise.all([
      supabase.from('community_resources').select('id', { count: 'exact' }),
      supabase.from('community_users').select('id', { count: 'exact' }),
      supabase.from('resource_downloads').select('id', { count: 'exact' }),
      supabase.from('resource_likes').select('id', { count: 'exact' })
    ]);

    return {
      totalResources: resources.count || 0,
      totalUsers: users.count || 0,
      totalDownloads: downloads.count || 0,
      totalLikes: likes.count || 0
    };
  }
}
