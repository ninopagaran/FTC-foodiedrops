import React, { useEffect, useMemo, useState } from 'react';
import { Drop, DropStatus } from '../types';

interface VendorPageProps {
  vendorSlug: string;
  drops: Drop[];
  onSelectDrop: (id: string) => void;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const formatDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString();
};

const getDropWindow = (drop: Drop) => {
  const now = Date.now();
  const starts = new Date(drop.start_date).getTime();
  const ends = new Date(drop.end_date).getTime();
  const isEnded = Number.isFinite(ends) && ends < now;
  const isSoldOut = drop.quantity_remaining <= 0;
  const isAvailableStatus = drop.status === DropStatus.LIVE || drop.status === DropStatus.UPCOMING;
  return isAvailableStatus && !isEnded && !isSoldOut;
};

export const VendorPage: React.FC<VendorPageProps> = ({ vendorSlug, drops, onSelectDrop }) => {
  const normalizedSlug = slugify(vendorSlug || '');
  const vendorDrops = useMemo(
    () => drops.filter((drop) => slugify(drop.chef || '') === normalizedSlug),
    [drops, normalizedSlug]
  );
  const [activeCategory, setActiveCategory] = useState('ALL');

  const availableVendorDrops = useMemo(
    () => vendorDrops.filter((drop) => getDropWindow(drop)),
    [vendorDrops]
  );

  const categories = useMemo(() => {
    const present = new Set(availableVendorDrops.map((drop) => drop.category).filter(Boolean));
    return ['ALL', ...Array.from(present)];
  }, [availableVendorDrops]);

  useEffect(() => {
    if (activeCategory !== 'ALL' && !categories.includes(activeCategory)) {
      setActiveCategory('ALL');
    }
  }, [activeCategory, categories]);

  const displayDrops = useMemo(() => {
    if (activeCategory === 'ALL') return availableVendorDrops;
    return availableVendorDrops.filter((drop) => drop.category === activeCategory);
  }, [activeCategory, availableVendorDrops]);

  const vendorName = vendorDrops[0]?.chef || vendorSlug;

  if (!vendorDrops.length) {
    return (
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-4">Vendor</p>
        <h1 className="font-heading text-4xl sm:text-6xl font-black tracking-tighter italic uppercase">{vendorSlug}</h1>
        <p className="mt-6 text-zinc-400">No products were found for this vendor.</p>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-4">Vendor Page</p>
        <h1 className="font-heading text-4xl sm:text-6xl font-black tracking-tighter italic uppercase">{vendorName}</h1>
        <p className="mt-4 text-zinc-400">
          {availableVendorDrops.length} available {availableVendorDrops.length === 1 ? 'product' : 'products'}
        </p>
      </section>

      {categories.length > 1 && (
        <div className="sticky top-[64px] md:top-[73px] z-40 bg-black/95 backdrop-blur-2xl border-y border-zinc-900 px-4 sm:px-6 py-3 sm:py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3 overflow-x-auto no-scrollbar">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${
                  activeCategory === category
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-white hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {displayDrops.length === 0 ? (
          <div className="border border-dashed border-zinc-800 py-16 text-center">
            <p className="text-zinc-500 font-bold">No available products in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {displayDrops.map((drop) => (
              <article key={drop.id} className="border border-zinc-900 bg-zinc-950 overflow-hidden">
                <img src={drop.image} alt={drop.name} className="w-full h-56 object-cover" />
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-heading text-3xl font-black tracking-tighter italic">{drop.name}</h2>
                    <span className="text-xl font-heading font-black">${drop.price}</span>
                  </div>
                  <p className="text-zinc-300">{drop.description}</p>

                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <p><span className="text-zinc-500">Category:</span> {drop.category || 'N/A'}</p>
                    <p><span className="text-zinc-500">Type:</span> {drop.type}</p>
                    <p><span className="text-zinc-500">Location:</span> {drop.location}</p>
                    <p><span className="text-zinc-500">Status:</span> {drop.status}</p>
                    <p><span className="text-zinc-500">Starts:</span> {formatDate(drop.start_date)}</p>
                    <p><span className="text-zinc-500">Ends:</span> {formatDate(drop.end_date)}</p>
                    <p><span className="text-zinc-500">Quantity:</span> {drop.quantity_remaining}/{drop.total_quantity}</p>
                    <p><span className="text-zinc-500">Delivery:</span> {drop.delivery_available ? `Yes ($${drop.delivery_fee})` : 'No'}</p>
                    <p><span className="text-zinc-500">Vendor Email:</span> {drop.vendor_contact?.email || 'N/A'}</p>
                    <p><span className="text-zinc-500">Vendor Phone:</span> {drop.vendor_contact?.phone || 'N/A'}</p>
                  </div>

                  {drop.hype_story && (
                    <p className="text-zinc-400 text-sm border-t border-zinc-900 pt-4">{drop.hype_story}</p>
                  )}

                  {(drop.menu_items || []).length > 0 && (
                    <div className="border-t border-zinc-900 pt-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Menu Items</p>
                      <ul className="space-y-1 text-sm text-zinc-300">
                        {(drop.menu_items || []).map((item) => (
                          <li key={item.id}>
                            {item.name} - ${item.basePrice}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={() => onSelectDrop(drop.id)}
                    className="w-full py-3 border border-white text-white font-black uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
                  >
                    View Product
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
