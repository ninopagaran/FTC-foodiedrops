
import React, { useState, useEffect } from 'react';
import { Drop, DropStatus, DropType } from '../types';
import { Countdown } from './Countdown';

interface DropCardProps {
  drop: Drop;
  onClick: (id: string) => void;
}

export const DropCard: React.FC<DropCardProps> = ({ drop, onClick }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dropStartsAt = new Date(drop.start_date);
  const dropEndsAt = new Date(drop.end_date);

  const isUpcoming = now < dropStartsAt;
  const isLive = now >= dropStartsAt && now < dropEndsAt;
  const hasEnded = now >= dropEndsAt;
  
  const isSoldOut = drop.quantity_remaining === 0;
  const isArchived = isSoldOut || hasEnded;

  const accentColor = drop.accent_color || '#d946ef';
  
  return (
    <div 
      onClick={() => onClick(drop.id)}
      className="group relative cursor-pointer overflow-hidden bg-zinc-950 border border-zinc-900 transition-all duration-300 hover:border-zinc-500/50"
      style={{ boxShadow: `0 0 40px -10px ${accentColor}33` }}
    >
      {/* Image Container */}
      <div className="aspect-[4/5] overflow-hidden relative">
        <img 
          src={drop.image} 
          alt={drop.name} 
          className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${isSoldOut ? 'grayscale blur-[2px]' : 'grayscale-[40%] group-hover:grayscale-0'}`}
        />
        
        {/* SOLD OUT Banner Overlay */}
        {isSoldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                <div className="bg-red-600 text-white border-4 border-white px-8 py-3 transform -rotate-12 shadow-[0_0_30px_rgba(220,38,38,0.6)]">
                    <span className="text-3xl font-heading font-black italic uppercase tracking-tighter block whitespace-nowrap">SOLD OUT</span>
                </div>
            </div>
        )}

        {/* Badges */}
        <div className="absolute left-4 top-4 flex flex-col gap-2 z-10">
          {isArchived ? (
            isSoldOut ? (
                <span className="bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-widest text-white border border-red-500">Sold Out</span>
            ) : (
                <span className="bg-zinc-800 px-3 py-1 text-xs font-black uppercase tracking-widest text-zinc-400">Archived</span>
            )
          ) : isUpcoming ? (
            <span className="bg-violet-600 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">Incoming</span>
          ) : (
            <span className="px-3 py-1 text-xs font-black uppercase tracking-widest text-black shadow-lg" style={{ backgroundColor: accentColor }}>Live</span>
          )}
          <span className="bg-black/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-md border border-white/10">
            {drop.type === DropType.PICKUP ? 'Pickup' : 'Event'}
          </span>
        </div>

        {/* Quantity Indicator */}
        {isLive && !isSoldOut && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
             <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] uppercase font-black text-white drop-shadow-lg tracking-tighter">
                  {drop.quantity_remaining < 20 ? 'Critical Supply' : 'Limited Run'}
                </span>
                <span className="text-[10px] font-black text-white drop-shadow-lg">
                  {drop.quantity_remaining}/{drop.total_quantity} Left
                </span>
             </div>
             <div className="h-1.5 w-full bg-white/10 overflow-hidden rounded-full">
                <div 
                  className="h-full transition-all duration-700 ease-out" 
                  style={{ width: `${(drop.quantity_remaining / drop.total_quantity) * 100}%`, backgroundColor: accentColor }}
                />
             </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className={`font-heading text-2xl font-black uppercase leading-[0.9] tracking-tighter transition-colors italic ${isSoldOut ? 'text-zinc-500 line-through decoration-red-500 decoration-4' : 'group-hover:text-white'}`} style={!isSoldOut ? { color: accentColor } : {}}>
            {drop.name}
          </h3>
          <span className={`text-xl font-heading font-black border-b-2 ${isSoldOut ? 'text-zinc-600 border-zinc-800' : 'text-white'}`} style={!isSoldOut ? { borderColor: accentColor } : {}}>${drop.price}</span>
        </div>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">{drop.chef} • {drop.location}</p>
        
        <div className="pt-4 border-t border-zinc-900 h-8 flex items-center">
          {isUpcoming && <Countdown targetDate={drop.start_date} prefix="🔔" className="text-violet-400" />}
          {isLive && !isSoldOut && <Countdown targetDate={drop.end_date} prefix="⏳" className="text-fuchsia-400" />}
          {isSoldOut && <span className="font-mono text-xs font-black uppercase tracking-widest text-red-500 animate-pulse">Inventory Depleted</span>}
          {!isSoldOut && hasEnded && <span className="font-mono text-xs font-black uppercase tracking-widest text-zinc-600">Manifest Closed</span>}
        </div>
      </div>
    </div>
  );
};
