import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Heart, 
  Eye, 
  User, 
  Calendar, 
  Tag, 
  Github, 
  Globe, 
  MessageSquare,
  Share2,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { CommunityResource, CommunityService, LocalUserManager, ResourceComment } from '../services/communityService';

interface ResourceDetailModalProps {
  resource: CommunityResource | null;
  isOpen: boolean;
  onClose: () => void;
}

const ResourceDetailModal: React.FC<ResourceDetailModalProps> = ({
  resource,
  isOpen,
  onClose
}) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [comments, setComments] = useState<ResourceComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const currentUser = LocalUserManager.getCurrentUser();

  useEffect(() => {
    if (resource) {
      setLikesCount(resource.likes_count);
      // TODO: Check if user has liked this resource
      checkUserLiked();
    }
  }, [resource]);

  const checkUserLiked = async () => {
    // This would require an API endpoint to check if current user liked the resource
    // For now, we'll assume not liked
    setLiked(false);
  };

  const handleLike = async () => {
    if (!resource || !currentUser) return;

    try {
      setIsLiking(true);
      const result = await CommunityService.toggleLike(resource.id);
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDownload = async () => {
    if (!resource) return;

    try {
      setIsDownloading(true);
      
      // Track download
      await CommunityService.incrementDownloads(resource.id);
      
      // Handle different content types
      if (resource.content_type === 'image/base64' && resource.content) {
        // Download image
        const link = document.createElement('a');
        link.href = resource.content;
        link.download = `${resource.title}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (resource.download_url) {
        // Open download URL
        window.open(resource.download_url, '_blank');
      } else if (resource.content) {
        // Download text content
        const blob = new Blob([resource.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${resource.title}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (error) {
      console.error('Error downloading resource:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const loadComments = async () => {
    if (!resource) return;

    try {
      setLoadingComments(true);
      const resourceComments = await CommunityService.getComments(resource.id);
      setComments(resourceComments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!resource || !newComment.trim() || !currentUser) return;

    try {
      setIsCommenting(true);
      const comment = await CommunityService.createComment(resource.id, newComment.trim());
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/community/resource/${resource?.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) {
      loadComments();
    }
  };

  if (!isOpen || !resource) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'custom-node': return '⚙️';
      case 'wallpaper': return '🖼️';
      case 'tool': return '🔧';
      case 'template': return '📄';
      case 'mcp-server': return '🌐';
      case 'workflow': return '🔄';
      case 'tutorial': return '📚';
      default: return '📦';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glassmorphic bg-white/95 dark:bg-gray-900/95 rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-gray-700/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getCategoryIcon(resource.category)}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {resource.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                by {resource.author_username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 dark:hover:bg-gray-700/30 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-8rem)] custom-scrollbar">
          <div className="p-6 space-y-6">
            {/* Image/Thumbnail */}
            {resource.thumbnail_url && (
              <div className="rounded-xl overflow-hidden">
                <img
                  src={resource.thumbnail_url}
                  alt={resource.title}
                  className="w-full max-h-64 object-cover"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Description
              </h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {resource.description}
              </p>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Tag className="w-4 h-4" />
                  <span className="font-medium">Category:</span>
                  <span className="capitalize">{resource.category.replace('-', ' ')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">Created:</span>
                  <span>{new Date(resource.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <User className="w-4 h-4" />
                  <span className="font-medium">Version:</span>
                  <span>{resource.version}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Eye className="w-4 h-4" />
                  <span className="font-medium">Views:</span>
                  <span>{resource.views_count}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Download className="w-4 h-4" />
                  <span className="font-medium">Downloads:</span>
                  <span>{resource.downloads_count}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Heart className="w-4 h-4" />
                  <span className="font-medium">Likes:</span>
                  <span>{likesCount}</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {resource.tags && resource.tags.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {resource.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-sakura-100 dark:bg-sakura-900/30 text-sakura-700 dark:text-sakura-300 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {(resource.github_url || resource.demo_url) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Links
                </h3>
                <div className="flex flex-wrap gap-3">
                  {resource.github_url && (
                    <a
                      href={resource.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl hover:bg-white/10 dark:hover:bg-gray-700/30 transition-all duration-200 text-gray-700 dark:text-gray-300"
                    >
                      <Github className="w-4 h-4" />
                      Source Code
                    </a>
                  )}
                  {resource.demo_url && (
                    <a
                      href={resource.demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl hover:bg-white/10 dark:hover:bg-gray-700/30 transition-all duration-200 text-gray-700 dark:text-gray-300"
                    >
                      <Globe className="w-4 h-4" />
                      Live Demo
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Comments ({comments.length})
                </h3>
                <button
                  onClick={toggleComments}
                  className="text-sm text-sakura-600 dark:text-sakura-400 hover:text-sakura-700 dark:hover:text-sakura-300"
                >
                  {showComments ? 'Hide Comments' : 'Show Comments'}
                </button>
              </div>

              {showComments && (
                <div className="space-y-4">
                  {/* Add Comment */}
                  {currentUser && (
                    <div className="glassmorphic p-4 rounded-xl border border-white/20 dark:border-gray-600/30">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="w-full p-3 bg-white/50 dark:bg-gray-800/50 border border-white/20 dark:border-gray-600/30 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleAddComment}
                          disabled={!newComment.trim() || isCommenting}
                          className="px-4 py-2 bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-400 text-white rounded-lg transition-all duration-200 flex items-center gap-2 disabled:cursor-not-allowed"
                        >
                          {isCommenting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Posting...
                            </>
                          ) : (
                            'Post Comment'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Comments List */}
                  {loadingComments ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-sakura-500" />
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No comments yet. Be the first to comment!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="glassmorphic p-4 rounded-xl border border-white/20 dark:border-gray-600/30"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {comment.author_username}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">
                            {comment.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-white/20 dark:border-gray-700/30 bg-white/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            {/* Like Button */}
            <button
              onClick={handleLike}
              disabled={!currentUser || isLiking}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 disabled:cursor-not-allowed ${
                liked
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'glassmorphic border border-white/20 dark:border-gray-600/30 hover:bg-white/10 dark:hover:bg-gray-700/30 text-gray-700 dark:text-gray-300'
              }`}
              title={!currentUser ? 'Login to like' : 'Toggle like'}
            >
              {isLiking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
              )}
              <span>{likesCount}</span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl hover:bg-white/10 dark:hover:bg-gray-700/30 transition-all duration-200 text-gray-700 dark:text-gray-300"
            >
              {copySuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </>
              )}
            </button>

            {/* Comments Toggle */}
            <button
              onClick={toggleComments}
              className="flex items-center gap-2 px-4 py-2 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl hover:bg-white/10 dark:hover:bg-gray-700/30 transition-all duration-200 text-gray-700 dark:text-gray-300"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{comments.length}</span>
            </button>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-6 py-3 bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-400 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Downloading...
              </>
            ) : downloaded ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResourceDetailModal;
