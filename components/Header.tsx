
import React, { useState } from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const navigate = (hash: string) => window.location.hash = hash;
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDropsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.location.hash === '#/' || window.location.hash === '') {
      document.getElementById('live-drops')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
      // Give time for route change before scrolling
      setTimeout(() => {
        document.getElementById('live-drops')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-black/95 backdrop-blur-xl border-b border-zinc-900/50 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer group">
            <div className="w-10 h-10 bg-fuchsia-500 text-black flex items-center justify-center font-bold text-2xl skew-x-[-12deg] group-hover:bg-white transition-all duration-300 shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">f</div>
            <span className="font-heading text-2xl font-black tracking-tighter italic uppercase">foodiedrops</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.2em]">
            <a href="/#/" onClick={handleDropsClick} className="hover:text-fuchsia-400 transition-colors">Drops</a>
            
            {user?.isAdmin && (
               <a href="/#/admin" onClick={(e) => { e.preventDefault(); navigate('/admin'); }} className="text-orange-400 hover:text-orange-300 transition-colors">Admin</a>
            )}

            <div className="h-4 w-[1px] bg-zinc-800" />
            
            {user ? (
              <div className="flex items-center gap-6 min-w-0">
                <button onClick={() => navigate('/profile')} className="hover:text-fuchsia-400 transition-colors min-w-0">
                  <span className="font-black block max-w-[160px] truncate">{user.name}</span>
                  {user.username && (
                    <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">@{user.username}</span>
                  )}
                </button>
                <button onClick={onLogout} className="text-zinc-600 hover:text-red-500 transition-colors text-[9px] tracking-widest">Logout</button>
              </div>
            ) : (
              <button onClick={() => navigate('/login')} className="hover:text-fuchsia-400 transition-colors border-b-2 border-transparent hover:border-fuchsia-500 pb-1">Log In</button>
            )}

            <button
              onClick={() => {
                if (user && !user.isVendor) return;
                navigate('/studio');
              }}
              disabled={!!user && !user.isVendor}
              title={user && !user.isVendor ? 'Foodie accounts are for ordering. Vendor accounts are for restaurants and require a separate email.' : 'For Restaurants'}
              className={`border-l border-zinc-800 pl-8 flex items-center gap-2 group transition-colors ${
                user && !user.isVendor ? 'text-zinc-600 cursor-not-allowed' : 'hover:text-fuchsia-400'
              }`}
            >
              For Restaurants
            </button>
          </nav>

          <div className="flex items-center gap-4 md:hidden">
            <button
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation"
              className="p-2 border border-zinc-800 hover:border-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-[200] overflow-y-auto">
            <button
              className="absolute inset-0 bg-black/70"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-x-0 top-0 bg-black/95 border-b border-zinc-900 pt-16 pb-6 px-6 shadow-2xl max-h-screen overflow-y-auto">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="absolute top-4 right-4 p-2 border border-zinc-800 hover:border-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="space-y-4 text-[11px] font-black uppercase tracking-[0.3em]">
                <button onClick={(e) => { setMobileOpen(false); handleDropsClick(e as any); }} className="w-full text-left text-zinc-300 hover:text-white">Drops</button>
                {user?.isAdmin && (
                  <button onClick={() => { setMobileOpen(false); navigate('/admin'); }} className="w-full text-left text-orange-400 hover:text-orange-300">Admin</button>
                )}
                {user ? (
                  <button onClick={() => { setMobileOpen(false); navigate('/profile'); }} className="w-full text-left text-zinc-300 hover:text-white">Profile</button>
                ) : (
                  <button onClick={() => { setMobileOpen(false); navigate('/login'); }} className="w-full text-left text-zinc-300 hover:text-white">Log In</button>
                )}
                <button
                  onClick={() => {
                    if (user && !user.isVendor) return;
                    setMobileOpen(false);
                    navigate('/studio');
                  }}
                  disabled={!!user && !user.isVendor}
                  className={`w-full text-left ${user && !user.isVendor ? 'text-zinc-600' : 'text-zinc-300 hover:text-white'}`}
                >
                  For Restaurants
                </button>
                {user && (
                  <button onClick={() => { setMobileOpen(false); onLogout(); }} className="w-full text-left text-red-400 hover:text-red-300">Logout</button>
                )}
                {user && !user.isVendor && (
                  <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-2">
                    Foodie accounts are for ordering. Vendor accounts require a separate email.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
