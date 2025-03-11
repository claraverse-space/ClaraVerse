import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Debug from './components/Debug';
import Assistant from './components/Assistant';
import Onboarding from './components/Onboarding';
import { db } from './db';
import Apps from './components/Apps';
import AppCreator from './components/AppCreator';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string } | null>(null);

  useEffect(() => {
    const checkUserInfo = async () => {
      const info = await db.getPersonalInfo();
      if (!info || !info.name) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
        setUserInfo({ name: info.name });
      }
    };
    checkUserInfo();
  }, []);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    const info = await db.getPersonalInfo();
    if (info) {
      setUserInfo({ name: info.name });
    }
  };
  
  // Get app ID from localStorage when opening app-creator
  useEffect(() => {
    if (activePage === 'app-creator') {
      const appId = localStorage.getItem('current_app_id');
      if (!appId) {
        // If no app ID is found, we're creating a new app
        console.log('Creating new app');
      } else {
        console.log('Editing app with ID:', appId);
      }
    }
  }, [activePage]);

  const renderContent = () => {
    if (activePage === 'assistant') {
      return <Assistant onPageChange={setActivePage} />;
    }
    
    if (activePage === 'app-creator') {
      // Get the app ID from localStorage (if editing an existing app)
      const appId = localStorage.getItem('current_app_id');
      return <AppCreator onPageChange={setActivePage} appId={appId || undefined} />;
    }

    return (
      <div className="flex h-screen">
        <Sidebar activePage={activePage} onPageChange={setActivePage} />
        
        <div className="flex-1 flex flex-col">
          <Topbar userName={userInfo?.name} onPageChange={setActivePage} />
          
          <main className="flex-1 p-6 overflow-auto">
            {(() => {
              switch (activePage) {
                case 'settings':
                  return <Settings />;
                case 'debug':
                  return <Debug />;
                case 'apps':
                  return <Apps onPageChange={setActivePage} />;
                case 'dashboard':
                default:
                  return <Dashboard onPageChange={setActivePage} />;
              }
            })()}
          </main>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-sakura-100 dark:from-gray-900 dark:to-sakura-100">
      {showOnboarding ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : (
        renderContent()
      )}
    </div>
  );
}

export default App;