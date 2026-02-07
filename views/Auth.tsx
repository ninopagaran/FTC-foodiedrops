
import React, { useState } from 'react';
import { Button } from '../components/Button';
import * as api from '../services/api';

interface AuthProps {
  onSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage("Email and password are required.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      if (mode === 'LOGIN') {
        await api.loginUser(email, password);
        onSuccess();
      } else {
        await api.signUpUser(email, password);
        // In the mock implementation, signUpUser automatically logs the user in.
        onSuccess();
      }
    } catch (error: any) {
      console.error(error);
      setMessage(error.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Ambient */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
             <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-fuchsia-600/20 blur-[120px] rounded-full" />
             <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-600/20 blur-[120px] rounded-full" />
        </div>

        <div className="w-full max-w-md bg-zinc-950 border-8 border-zinc-900 p-8 md:p-12 relative z-10 shadow-2xl">
            <div className="text-center mb-8">
                <div onClick={() => window.location.hash = '/'} className="w-16 h-16 bg-white text-black flex items-center justify-center font-bold text-4xl skew-x-[-12deg] mb-6 shadow-[4px_4px_0px_0px_rgba(217,70,239,1)] mx-auto cursor-pointer">f</div>
                <h1 className="font-heading text-3xl font-black italic uppercase tracking-tighter mb-2">
                    {mode === 'LOGIN' ? 'Welcome Back' : 'Join The Drop'}
                </h1>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                    {mode === 'LOGIN' ? 'Login to access your dashboard' : 'Create an account to track orders'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Email Address <span className="text-fuchsia-500">*</span></label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-zinc-900 border-4 border-zinc-800 p-4 font-bold text-lg text-white focus:border-fuchsia-500 outline-none transition-colors"
                        placeholder="YOU@EXAMPLE.COM"
                        required
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Password <span className="text-fuchsia-500">*</span></label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-zinc-900 border-4 border-zinc-800 p-4 font-bold text-lg text-white focus:border-fuchsia-500 outline-none transition-colors"
                        placeholder="••••••••"
                        required
                    />
                </div>

                {message && (
                    <div className={`p-4 text-xs font-bold text-center border-2 ${message.includes('Success') ? 'border-green-500 text-green-400 bg-green-900/20' : 'border-red-500 text-red-400 bg-red-900/20'}`}>
                        {message}
                    </div>
                )}

                <Button size="lg" type="submit" isLoading={isLoading} className="w-full shadow-[6px_6px_0px_0px_#fff]">
                    {mode === 'LOGIN' ? 'Log In' : 'Create Account'}
                </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-zinc-900 text-center">
                <p className="text-zinc-500 text-xs mb-3 font-bold">
                    {mode === 'LOGIN' ? "New to FoodieDrops?" : "Already have an account?"}
                </p>
                <button 
                    onClick={() => {
                        setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                        setMessage(null);
                        setEmail('');
                        setPassword('');
                    }}
                    className="text-fuchsia-500 text-xs font-black uppercase tracking-widest hover:text-white transition-colors border-b-2 border-fuchsia-500 hover:border-white pb-1"
                >
                    {mode === 'LOGIN' ? 'Create Account' : 'Log In Instead'}
                </button>
            </div>
        </div>
    </div>
  );
};
