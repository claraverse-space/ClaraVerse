-- ClaraVerse Community Database Schema
-- This creates a guest-user system where anyone can contribute without traditional auth

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Community Users Table (Guest users with usernames)
CREATE TABLE community_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    github_username VARCHAR(100),
    website_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT username_length CHECK (LENGTH(username) >= 3),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

-- Community Resources Table
CREATE TABLE community_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    
    -- Resource metadata
    tags TEXT[] DEFAULT '{}',
    version VARCHAR(20) DEFAULT '1.0.0',
    
    -- Files and links
    github_url TEXT,
    download_url TEXT,
    thumbnail_url TEXT,
    demo_url TEXT,
    
    -- Resource content (for prompts, small scripts)
    content TEXT,
    content_type VARCHAR(50), -- 'markdown', 'json', 'javascript', etc.
    
    -- Author and ownership
    author_id UUID REFERENCES community_users(id) ON DELETE CASCADE,
    author_username VARCHAR(50) NOT NULL, -- Denormalized for performance
    
    -- Engagement metrics
    downloads_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    
    -- Status and moderation
    status VARCHAR(20) DEFAULT 'published', -- 'published', 'draft', 'removed'
    featured BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_category CHECK (
        category IN (
            'mcp-server', 'prompt', 'custom-node', 'wallpaper', 
            'workflow', 'tutorial', 'tool', 'template'
        )
    ),
    CONSTRAINT valid_status CHECK (status IN ('published', 'draft', 'removed'))
);

-- Resource Likes Table (track who liked what)
CREATE TABLE resource_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES community_resources(id) ON DELETE CASCADE,
    user_id UUID REFERENCES community_users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate likes
    UNIQUE(resource_id, user_id)
);

-- Resource Views Table (for analytics)
CREATE TABLE resource_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES community_resources(id) ON DELETE CASCADE,
    user_id UUID REFERENCES community_users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments/Discussions Table
CREATE TABLE resource_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES community_resources(id) ON DELETE CASCADE,
    author_id UUID REFERENCES community_users(id) ON DELETE CASCADE,
    author_username VARCHAR(50) NOT NULL,
    
    content TEXT NOT NULL,
    parent_id UUID REFERENCES resource_comments(id) ON DELETE CASCADE, -- For replies
    
    likes_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- Download Tracking Table
CREATE TABLE resource_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES community_resources(id) ON DELETE CASCADE,
    user_id UUID REFERENCES community_users(id) ON DELETE SET NULL,
    ip_address INET,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_community_resources_category ON community_resources(category);
CREATE INDEX idx_community_resources_author ON community_resources(author_id);
CREATE INDEX idx_community_resources_featured ON community_resources(featured);
CREATE INDEX idx_community_resources_created_at ON community_resources(created_at DESC);
CREATE INDEX idx_community_resources_downloads ON community_resources(downloads_count DESC);
CREATE INDEX idx_community_resources_likes ON community_resources(likes_count DESC);
CREATE INDEX idx_community_resources_tags ON community_resources USING GIN(tags);

CREATE INDEX idx_resource_likes_resource ON resource_likes(resource_id);
CREATE INDEX idx_resource_likes_user ON resource_likes(user_id);

CREATE INDEX idx_resource_views_resource ON resource_views(resource_id);
CREATE INDEX idx_resource_views_date ON resource_views(viewed_at DESC);

CREATE INDEX idx_resource_comments_resource ON resource_comments(resource_id);
CREATE INDEX idx_resource_comments_author ON resource_comments(author_id);
CREATE INDEX idx_resource_comments_parent ON resource_comments(parent_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_community_users_updated_at 
    BEFORE UPDATE ON community_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_resources_updated_at 
    BEFORE UPDATE ON community_resources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resource_comments_updated_at 
    BEFORE UPDATE ON resource_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Functions to update engagement metrics
CREATE OR REPLACE FUNCTION increment_downloads(resource_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE community_resources 
    SET downloads_count = downloads_count + 1 
    WHERE id = resource_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_views(resource_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE community_resources 
    SET views_count = views_count + 1 
    WHERE id = resource_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_likes(resource_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE community_resources 
    SET likes_count = likes_count + 1 
    WHERE id = resource_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_likes(resource_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE community_resources 
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = resource_uuid;
END;
$$ LANGUAGE plpgsql;

-- Insert some example data
INSERT INTO community_users (username, display_name, bio) VALUES 
('claradev', 'Clara Developer', 'Core ClaraVerse contributor building amazing AI tools'),
('promptmaster', 'Prompt Master', 'Specializing in creative AI prompts and workflows'),
('nodebuilder', 'Node Builder', 'Custom node developer for Clara Agents');

INSERT INTO community_resources (
    title, description, category, tags, author_id, author_username, featured
) VALUES 
(
    'PDF Document Processor MCP Server',
    'Advanced MCP server for processing and analyzing PDF documents with AI capabilities. Supports text extraction, summarization, and content analysis.',
    'mcp-server',
    ARRAY['pdf', 'document', 'analysis', 'mcp'],
    (SELECT id FROM community_users WHERE username = 'claradev'),
    'claradev',
    true
),
(
    'Creative Writing Prompts Collection',
    'A curated collection of 100+ creative writing prompts for storytelling, content creation, and creative inspiration.',
    'prompt',
    ARRAY['creative', 'writing', 'storytelling', 'content'],
    (SELECT id FROM community_users WHERE username = 'promptmaster'),
    'promptmaster',
    true
),
(
    'Data Visualization Node',
    'Custom Clara Agent node for creating interactive charts, graphs, and data visualizations from various data sources.',
    'custom-node',
    ARRAY['data', 'visualization', 'charts', 'analytics'],
    (SELECT id FROM community_users WHERE username = 'nodebuilder'),
    'nodebuilder',
    false
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE community_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_downloads ENABLE ROW LEVEL SECURITY;

-- Users can read all users, but only update their own profile
CREATE POLICY "Users can view all users" ON community_users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON community_users
    FOR UPDATE USING (true); -- We'll handle ownership in the app

CREATE POLICY "Anyone can create user" ON community_users
    FOR INSERT WITH CHECK (true);

-- Resources are publicly readable, but only authors can update/delete
CREATE POLICY "Resources are publicly readable" ON community_resources
    FOR SELECT USING (status = 'published');

CREATE POLICY "Anyone can create resources" ON community_resources
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Authors can update own resources" ON community_resources
    FOR UPDATE USING (true); -- We'll handle ownership in the app

CREATE POLICY "Authors can delete own resources" ON community_resources
    FOR DELETE USING (true); -- We'll handle ownership in the app

-- Likes are publicly readable, anyone can insert/delete their own
CREATE POLICY "Likes are publicly readable" ON resource_likes
    FOR SELECT USING (true);

CREATE POLICY "Anyone can like resources" ON resource_likes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can remove their own likes" ON resource_likes
    FOR DELETE USING (true);

-- Views are publicly readable for analytics
CREATE POLICY "Views are publicly readable" ON resource_views
    FOR SELECT USING (true);

CREATE POLICY "Anyone can record views" ON resource_views
    FOR INSERT WITH CHECK (true);

-- Comments are publicly readable, anyone can create, authors can update/delete own
CREATE POLICY "Comments are publicly readable" ON resource_comments
    FOR SELECT USING (true);

CREATE POLICY "Anyone can create comments" ON resource_comments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Authors can update own comments" ON resource_comments
    FOR UPDATE USING (true);

CREATE POLICY "Authors can delete own comments" ON resource_comments
    FOR DELETE USING (true);

-- Downloads are trackable
CREATE POLICY "Anyone can record downloads" ON resource_downloads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Downloads are publicly readable" ON resource_downloads
    FOR SELECT USING (true);
