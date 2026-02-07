
import React, { useState } from 'react';
import { User, Purchase } from '../types';
import { Button } from '../components/Button';
import * as api from '../services/api';

interface ProfileProps {
  user: User;
  purchases: Purchase[];
  onLogout: () => void;
  onBack: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, purchases, onLogout, onBack }) => {
  const sortedPurchases = [...purchases].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const [resumingPurchaseId, setResumingPurchaseId] = useState<string | null>(null);

  const tierColor = {
    'Taster': 'text-zinc-400',
    'Regular': 'text-blue-400',
    'Insider': 'text-violet-400',
    'Tastemaker': 'text-orange-400'
  }[user.tier];

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-8">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="bg-fuchsia-600 text-black p-3 hover:bg-white transition-all shadow-[4px_4px_0px_0px_#fff]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M10 19l-7-7 7-7"></path></svg>
            </button>
            <h1 className="font-heading text-5xl font-black italic uppercase tracking-tighter leading-none">Your Profile</h1>
          </div>
          <Button onClick={onLogout} variant="danger" size="sm" className="bg-zinc-900 border-2 border-zinc-800 text-zinc-600 hover:text-white hover:bg-red-600 hover:border-red-600 shadow-none hover:shadow-lg">
            Log Out
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4">
            <div className="bg-zinc-950 border-4 border-zinc-900 p-10 sticky top-40 space-y-10">
              <div className="text-center">
                <div className="w-20 h-20 bg-black border-4 border-fuchsia-500 rounded-full mx-auto mb-6 flex items-center justify-center text-3xl font-black italic shadow-[0_0_20px_rgba(217,70,239,0.4)]">
                  {user.name.charAt(0)}
                </div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">{user.name}</h2>
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">{user.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-8 text-center pt-8 border-t border-zinc-900">
                <div>
                  <span className="block text-[9px] uppercase font-black tracking-widest text-zinc-600">Tier</span>
                  <span className={`text-xl font-black uppercase italic tracking-tighter ${tierColor}`}>{user.tier}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-black tracking-widest text-zinc-600">Points</span>
                  <span className="text-xl font-black uppercase italic tracking-tighter text-fuchsia-400">{user.points}</span>
                </div>
                 <div>
                  <span className="block text-[9px] uppercase font-black tracking-widest text-zinc-600">Drop Streak</span>
                  <span className="text-xl font-black uppercase italic tracking-tighter">{user.streak}</span>
                </div>
                 <div>
                  <span className="block text-[9px] uppercase font-black tracking-widest text-zinc-600">Orders</span>
                  <span className="text-xl font-black uppercase italic tracking-tighter">{purchases.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500 mb-8">Order History</h3>
            <div className="space-y-6">
              {sortedPurchases.length > 0 ? (
                sortedPurchases.map(p => {
                  return (
                    <div key={p.id} className="flex flex-col md:flex-row items-start gap-8 bg-zinc-950/70 p-6 border-l-4 border-zinc-900 hover:border-fuchsia-500 transition-all">
                      <img src={p.drop_image} alt={p.drop_name} className="w-full md:w-32 aspect-square object-cover grayscale-[30%]"/>
                      <div className="flex-1 w-full">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-xl font-heading font-black italic uppercase tracking-tighter">{p.drop_name}</h4>
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">ORDER ID: {p.id}</span>
                          </div>
                          <div className="text-right">
                             <span className="block text-xl font-heading font-black italic text-fuchsia-400">${Number(p.total_paid).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="bg-black p-4 text-[10px] font-mono text-zinc-500 max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                           <p><strong>Timestamp:</strong> {new Date(p.timestamp).toLocaleString()}</p>
                           <p><strong>Quantity:</strong> {p.quantity}</p>
                           <p><strong>Payment:</strong> {p.payment_status?.toUpperCase?.() || 'PENDING'}</p>
                           {p.is_bulk && <p><strong>Type:</strong> BULK</p>}
                           {p.delivery_requested && <p className="text-fuchsia-500"><strong>Fulfillment:</strong> DELIVERY</p>}
                           {p.order_notes && <p><strong>Notes:</strong> {p.order_notes}</p>}
                           {p.unlocked_reward && <p className="text-orange-400"><strong>Unlocked:</strong> {p.unlocked_reward}</p>}
                           {p.selected_items && p.selected_items.map((si, idx) => (
                             <div key={idx} className="pt-2 border-t border-zinc-800">
                               <p className="font-bold text-zinc-400">{si.name} (x{p.quantity})</p>
                               {si.selectedModifiers.map(sm => sm.options.length > 0 && (
                                  <p key={sm.groupId} className="pl-2">&bull; {sm.groupName}: {sm.options.map(o => o.name).join(', ')}</p>
                               ))}
                             </div>
                           ))}
                        </div>
                        
                        {/* High Priority Fix: Allow user to pay if they missed the success screen */}
                        {p.payment_status === 'pending' && (
                            <div className="mt-4 pt-4 border-t border-zinc-900 flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase text-zinc-500 italic">Reservation Held</span>
                                <Button 
                                    size="sm" 
                                    isLoading={resumingPurchaseId === p.id}
                                    onClick={async () => {
                                      try {
                                        setResumingPurchaseId(p.id);
                                        const url = await api.createCheckoutSession(p.id, window.location.origin);
                                        window.location.assign(url);
                                      } catch (error: any) {
                                        alert(error.message || 'Unable to open Stripe checkout.');
                                      } finally {
                                        setResumingPurchaseId(null);
                                      }
                                    }}
                                    className="bg-fuchsia-500 text-black shadow-none text-[10px]"
                                >
                                    Complete Payment
                                </Button>
                            </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-32 border-4 border-dashed border-zinc-900">
                  <p className="text-zinc-800 text-2xl font-black uppercase italic tracking-tighter">No orders placed yet.</p>
                  <Button onClick={onBack} size="lg" className="mt-8">Explore Drops</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
