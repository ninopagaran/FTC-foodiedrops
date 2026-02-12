
import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  cartCount: number;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogin, onLogout, cartCount }) => {
  const navigate = (hash: string) => window.location.hash = hash;

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
      <div className="max-w-7xl mx-auto flex items-center justify-between">
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
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/profile')} className="hover:text-fuchsia-400 transition-colors">
                <span className="font-black">{user.name}</span>
                {user.username && (
                  <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">@{user.username}</span>
                )}
              </button>
              <button onClick={onLogout} className="text-zinc-600 hover:text-red-500 transition-colors text-[9px] tracking-widest">Logout</button>
            </div>
          ) : (
            <button onClick={() => navigate('/login')} className="hover:text-fuchsia-400 transition-colors border-b-2 border-transparent hover:border-fuchsia-500 pb-1">Log In</button>
          )}

          <button onClick={() => navigate('/studio')} className="hover:text-fuchsia-400 transition-colors border-l border-zinc-800 pl-8 flex items-center gap-2 group">
            For Restaurants
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={() => (user ? navigate('/profile') : navigate('/login'))}
            aria-label={user ? 'View your orders' : 'Log in to view your orders'}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors relative group"
          >
            <svg className="w-6 h-6 group-hover:scale-110 group-hover:text-fuchsia-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
            {cartCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-fuchsia-500 text-[10px] flex items-center justify-center rounded-full text-black font-black">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
};
