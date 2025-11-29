import React, { useMemo } from 'react';
import { Page, User, UserRole, Message } from '../types';
import NotificationBell from './NotificationBell';
import Avatar from './Avatar';
import { toAbsoluteImageUrl } from './imageUtils';
import './Header.css';

interface HeaderProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  conversations: Message[]; // Using Message[] until a dedicated Conversation type is introduced
  currentUser: User | null;
  onBecomeHostClick: () => void;
  onSignInClick: () => void;
  onSignOut: () => void;
}

const NavLink: React.FC<{
  page: Page;
  activePage: Page;
  onClick: (page: Page) => void;
  children: React.ReactNode;
}> = ({ page, activePage, onClick, children }) => {
  const isActive = page === activePage;
  return (
    <button
      onClick={() => onClick(page)}
      className={`nav-link ${isActive ? 'nav-link--active' : ''}`}
    >
      {children}
      {isActive && (
        <span className="nav-link__indicator"></span>
      )}
    </button>
  );
};

const Header: React.FC<HeaderProps> = ({ 
  activePage, 
  setActivePage, 
  conversations, 
  currentUser,
  onBecomeHostClick,
  onSignInClick,
  onSignOut,
}) => {
  // Determine which navigation pages to show based on authentication / role
  const isAuthenticated = !!currentUser;
  const userRole: UserRole | undefined = currentUser?.role as UserRole | undefined;

  const navPages: Page[] = useMemo(() => {
    // Always allow Explore
    if (!isAuthenticated) {
      return ['Explore'];
    }
    // Base pages for any authenticated user
    const pages: Page[] = ['Explore', 'Bookings', 'Messages'];
    // Host-specific
    if (userRole === 'host' || userRole === 'admin') {
      pages.push('Host Dashboard');
    }
    // Admin-specific
    if (userRole === 'admin') {
      pages.push('Admin Dashboard');
    }
    return pages;
  }, [isAuthenticated, userRole]);

  return (
    <header className="header">
      <div className="header__container">
        <div className="header__logo">
          <svg
            className="header__logo-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            ></path>
          </svg>
          <span className="header__logo-text">IdealStay</span>
        </div>
        <nav className="header__nav" aria-label="Primary">
          {navPages.map((page) => (
            <NavLink key={page} page={page} activePage={activePage} onClick={setActivePage}>
              {page}
            </NavLink>
          ))}
        </nav>
        <div className="header__actions">
          <NotificationBell conversations={conversations} setActivePage={setActivePage} />
          {currentUser ? (
            <>
              <button
                className="icon-button"
                onClick={() => setActivePage('Settings')}
                aria-label="Settings"
                title="Settings"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <div className="user-profile">
                <Avatar 
                  src={toAbsoluteImageUrl(currentUser.profile_image_url)}
                  alt={`${currentUser.first_name} ${currentUser.last_name}`} 
                  className="user-profile__avatar" 
                />
                <span className="user-profile__name">{currentUser.first_name}</span>
              </div>
              <button className="button button--secondary" onClick={onSignOut}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              {/* Keep the CTA for becoming a host visible even when only Explore nav is shown */}
              <button className="button button--secondary" onClick={onBecomeHostClick}>
                Become a Host
              </button>
              <button className="button button--primary" onClick={onSignInClick}>
                Login / Register
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
