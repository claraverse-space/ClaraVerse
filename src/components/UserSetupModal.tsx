import React, { useState } from 'react';
import { X, User, Github, Globe, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { CommunityService } from '../services/communityService';

interface UserSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (user: { id: string; username: string }) => void;
}

const UserSetupModal: React.FC<UserSetupModalProps> = ({ isOpen, onClose, onUserCreated }) => {
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: '',
    github_username: '',
    website_url: ''
  });
  
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check username availability with debouncing
  const checkUsername = async (username: string) => {
    if (username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    
    try {
      const isAvailable = await CommunityService.checkUsernameAvailable(username);
      setUsernameStatus(isAvailable ? 'available' : 'taken');
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameStatus('idle');
    }
  };

  // Debounced username check
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.username && formData.username.length >= 3) {
        checkUsername(formData.username);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (usernameStatus !== 'available') {
      setError('Please choose an available username');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const user = await CommunityService.createUser({
        username: formData.username,
        display_name: formData.display_name || undefined,
        bio: formData.bio || undefined,
        github_username: formData.github_username || undefined,
        website_url: formData.website_url || undefined
      });

      onUserCreated({ id: user.id, username: user.username });
      onClose();
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const getUsernameIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
      case 'available':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'taken':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getUsernameMessage = () => {
    switch (usernameStatus) {
      case 'checking':
        return 'Checking availability...';
      case 'available':
        return 'Username is available!';
      case 'taken':
        return 'Username is already taken';
      default:
        return 'Choose a unique username (3+ characters, letters, numbers, - and _ only)';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glassmorphic bg-white/90 dark:bg-gray-900/90 rounded-2xl max-w-md w-full border border-white/20 dark:border-gray-700/30 shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sakura-500 rounded-xl">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Welcome to ClaraVerse Community!
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create your profile to start sharing
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username - Required */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  minLength={3}
                  pattern="^[a-zA-Z0-9_-]+$"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                  className="w-full px-4 py-2.5 pr-10 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all duration-200"
                  placeholder="your_username"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {getUsernameIcon()}
                </div>
              </div>
              <p className={`text-xs mt-1 ${
                usernameStatus === 'available' ? 'text-green-600' :
                usernameStatus === 'taken' ? 'text-red-600' :
                'text-gray-500 dark:text-gray-400'
              }`}>
                {getUsernameMessage()}
              </p>
            </div>

            {/* Display Name - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full px-4 py-2.5 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all duration-200"
                placeholder="Your display name"
              />
            </div>

            {/* Bio - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Tell the community about yourself..."
              />
            </div>

            {/* GitHub Username - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                GitHub Username
              </label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.github_username}
                  onChange={(e) => setFormData({ ...formData, github_username: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all duration-200"
                  placeholder="github_username"
                />
              </div>
            </div>

            {/* Website - Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Website
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={formData.website_url}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all duration-200"
                  placeholder="https://your-website.com"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={usernameStatus !== 'available' || isCreating}
              className="w-full py-3 bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Profile...
                </>
              ) : (
                'Create Profile'
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> Your username will be stored locally on your device. 
              You can only edit or delete resources you create with this profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSetupModal;
