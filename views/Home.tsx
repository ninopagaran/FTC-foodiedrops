
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Drop, DropStatus, SortOption, User } from '../types';
import { DropCard } from '../components/DropCard';
import { Button } from '../components/Button';

interface HomeProps {
  user: User | null;
  drops: Drop[];
  onSelectDrop: (id: string) => void;
  onPartnerClick: () => void;
}

const CATEGORIES = ['ALL', 'BBQ', 'Japanese', 'Drinks', 'Fusion', 'Pantry', 'Vegan', 'Dessert'];

const Reveal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    if (domRef.current) observer.observe(domRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      {children}
    </div>
  );
};

export const Home: React.FC<HomeProps> = ({ user, drops, onSelectDrop, onPartnerClick }) => {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('NEWEST');
  const [searchQuery, setSearchQuery] = useState('');

  const displayDrops = useMemo(() => {
    // Combine Live and Upcoming into the main view
    const relevantDrops = drops.filter(d => d.status === DropStatus.LIVE || d.status === DropStatus.UPCOMING);

    let result = activeCategory === 'ALL' 
      ? relevantDrops 
      : relevantDrops.filter(d => d.category === activeCategory);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.chef.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q)
      );
    }

    switch(sortBy) {
      case 'PRICE_LOW': return [...result].sort((a, b) => Number(a.price) - Number(b.price));
      case 'FASTEST': return [...result].sort((a, b) => (a.quantity_remaining / a.total_quantity) - (b.quantity_remaining / b.total_quantity));
      case 'DATE': return [...result].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      default: 
        // Default Sort: Live drops first (sorted by end date?), then Upcoming (sorted by start date)
        return [...result].sort((a, b) => {
           const scoreA = a.status === DropStatus.LIVE ? 0 : 1;
           const scoreB = b.status === DropStatus.LIVE ? 0 : 1;
           
           if (scoreA !== scoreB) return scoreA - scoreB; // Live before Upcoming
           
           if (a.status === DropStatus.LIVE) {
               // For Live drops, maybe sort by ending soonest? or Newest?
               // Let's stick to default creation order or end date
               return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
           } else {
               // For Upcoming, sort by starting soonest
               return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
           }
        });
    }
  }, [drops, activeCategory, sortBy, searchQuery]);

  const ctaText = user?.isVendor ? 'Create a Drop' : 'Apply to Drop';

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Hero Section */}
      <section className="relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1514355315815-2b64b0216b14?auto=format&fit=crop&q=80&w=2000" 
            alt="Hero background"
            className="w-full h-full object-cover opacity-30 contrast-125 grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-[#050505]/20" />
        </div>
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <Reveal>
            <h1 className="font-heading text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight">
              Limited Food Drops.
              <br />
              Order Before The Cutoff.
            </h1>
          </Reveal>
          <Reveal>
            <p className="text-zinc-300 text-base md:text-lg font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
              Special menu releases from real restaurants.
              <br/>
              Order once. Pickup when it’s ready.
            </p>
          </Reveal>
          <Reveal>
            <div className="flex justify-center">
              <Button size="lg" onClick={() => document.getElementById('live-drops')?.scrollIntoView({ behavior: 'smooth' })}>
                View The Drops
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
      
      {/* Trust Strip */}
      <section className="bg-black py-8 border-y border-zinc-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-center">
            {['Support Local Kitchens', 'Limited Runs Only', 'More Money to Restaurants', 'No Algorithms', 'Pickup & Local Delivery'].map(item => (
              <div key={item} className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">{item}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="sticky top-[73px] z-40 bg-black/95 backdrop-blur-2xl border-b border-zinc-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
           <div className="flex items-center gap-3 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest border transition-all duration-300 whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'bg-white text-black border-white' 
                    : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-white hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <section id="live-drops" className="max-w-7xl mx-auto px-6 py-20">
        <Reveal>
          <div className="flex items-end gap-6 mb-12">
            <div>
               <h2 className="font-heading text-4xl md:text-6xl font-black tracking-tighter leading-none">Live & Incoming</h2>
            </div>
          </div>
        </Reveal>
        {displayDrops.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
            {displayDrops.map((drop) => (
              <Reveal key={drop.id}>
                <DropCard drop={drop} onClick={onSelectDrop} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 border-2 border-dashed border-zinc-900">
            <p className="text-zinc-600 text-xl font-bold">No drops found matching your criteria.</p>
          </div>
        )}
      </section>

      {/* What is a Drop? Section */}
      <section className="bg-zinc-950 py-20 px-6 border-y border-zinc-900">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="font-heading text-4xl md:text-6xl font-black tracking-tighter leading-tight mb-6">Not Your Typical Takeout.</h2>
            <p className="text-zinc-400 text-base leading-relaxed mb-8">
              A drop is a limited-release menu created by a restaurant for a short window — sometimes a weekend, sometimes just a day. Chefs use drops to test new ideas, bring back cult favorites, and cook without constraints. You get access to food most people never even hear about. When it sells out, it’s gone.
            </p>
            <Button size="lg" onClick={() => document.getElementById('live-drops')?.scrollIntoView({ behavior: 'smooth' })}>
              → Browse The Drops
            </Button>
          </Reveal>
        </div>
      </section>

      {/* Feature Strip */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <h2 className="font-heading text-center text-4xl font-black tracking-tighter mb-12">Why People Love Drops</h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              { title: 'Limited by design', desc: 'Small batches mean higher quality and more creativity.' },
              { title: 'Worth planning for', desc: "These aren’t everyday menus — they’re events." },
              { title: 'Support local without thinking twice', desc: 'Your order directly fuels independent kitchens.' },
              { title: 'Discovery built in', desc: 'Find chefs before everyone else does.' }
            ].map(feature => (
              <Reveal key={feature.title}>
                <div className="border-t-4 border-fuchsia-500 pt-6">
                  <h3 className="font-heading text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-zinc-400 text-sm">{feature.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

       {/* Social Proof Section */}
       <section className="bg-zinc-950 py-20 px-6 border-y border-zinc-900">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <h2 className="font-heading text-center text-4xl font-black tracking-tighter mb-12">Kitchens People Are Watching</h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { quote: "Drops let us cook the food we actually get excited about.", author: "Chef Marco, Ostia" },
              { quote: "Our last drop sold out in 6 hours.", author: "Pitmaster Jax" },
              { quote: "We made more in one weekend than a typical weeknight service.", author: "Neon Sushi" },
            ].map(({quote, author}) => (
              <Reveal key={author}>
                <figure className="text-center">
                  <blockquote className="text-xl font-medium mb-4">“{quote}”</blockquote>
                  <figcaption className="text-fuchsia-400 font-bold uppercase text-[10px] tracking-widest">{author}</figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Restaurant CTA */}
      <section className="bg-fuchsia-500 text-black py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
           <Reveal>
            <h2 className="font-heading text-4xl md:text-6xl font-black tracking-tighter leading-tight mb-4">Run a Drop. Keep More Revenue. Reach People Who Show Up Hungry.</h2>
            <p className="font-heading text-3xl font-bold italic tracking-tighter text-black/90 mb-6">Restaurants</p>
            <p className="text-black/80 text-base leading-relaxed mb-8 font-medium">
              Foodie Drops gives restaurants a launchpad — not a toll booth. No massive commissions. No fighting algorithms. No discount pressure. Just a direct line to customers who want what you make.
            </p>
            <Button size="xl" onClick={onPartnerClick} className="bg-black text-white hover:bg-zinc-800 shadow-none">
              {ctaText}
            </Button>
          </Reveal>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-black border-t-2 border-zinc-900 py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
           <Reveal>
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold text-lg">f</div>
              <span className="font-heading text-xl font-black tracking-tighter uppercase">foodiedrops</span>
            </div>
            <p className="text-zinc-500 text-base max-w-2xl mx-auto mb-4 font-medium">
              The New Standard for Independent Food Releases.
            </p>
            <p className="text-zinc-600 text-xs max-w-3xl mx-auto mb-8">
              Foodie Drops is building the modern marketplace for limited-run dining — where chefs create freely and customers discover the extraordinary. Launching city by city. Kitchen by kitchen. Drop by drop.
            </p>
            <p className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest">© 2024 FOODIEDROPS. EAT RARE.</p>
           </Reveal>
        </div>
      </footer>
    </div>
  );
};
