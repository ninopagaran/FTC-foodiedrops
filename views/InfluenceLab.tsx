
import React, { useState, useRef } from 'react';
import { Button } from '../components/Button';
import { User, Drop } from '../types';

interface InfluenceLabProps {
  user: User | null;
  drops: Drop[];
  onBack: () => void;
  onLogin: () => void;
}

export const InfluenceLab: React.FC<InfluenceLabProps> = ({ user, drops, onBack, onLogin }) => {
  const [selectedDropId, setSelectedDropId] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [hypeScript, setHypeScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const selectedDrop = drops.find(d => d.id === selectedDropId);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsRecording(true);
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
        setMediaPreview(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
    } catch (err) {
      alert("Camera access denied. Please enable camera and microphone permissions in your browser settings.");
    }
  };

  const stopCamera = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSynthesizeHype = async () => {
    if (!selectedDropId) return alert("Please select a drop to review.");
    setIsGenerating(true);
    
    // Simulate generation delay for effect
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const dropName = selectedDrop?.name || 'this drop';
    const chefName = selectedDrop?.chef || 'the chef';
    const script = `Yo! I just got my hands on ${dropName} by ${chefName}. The smell alone is incredible. If you haven't ordered yet, you're missing out on serious flavor. Check it out before it's gone!`;
    
    setHypeScript(script);
    setIsGenerating(false);
  };

  const handleSubmitCollab = () => {
    setHasSubmitted(true);
    setTimeout(() => {
      onBack();
    }, 3000);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-fuchsia-500 text-black flex items-center justify-center font-bold text-5xl skew-x-[-12deg] mb-12 shadow-[8px_8px_0px_0px_#fff]">i</div>
        <h1 className="font-heading text-4xl font-black italic uppercase tracking-tighter mb-6">Login Required</h1>
        <p className="text-zinc-500 font-black uppercase tracking-[0.3em] mb-12 max-w-md">Please log in to access the Influence Lab.</p>
        <Button size="xl" onClick={onLogin}>Log In</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="bg-fuchsia-600 text-black p-3 hover:bg-white transition-all shadow-[4px_4px_0px_0px_#fff]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M10 19l-7-7 7-7"></path></svg>
            </button>
            <h1 className="font-heading text-5xl font-black italic uppercase tracking-tighter leading-none">Influence Lab</h1>
          </div>
          <div className="bg-zinc-950 px-6 py-2 border-2 border-zinc-900 flex items-center gap-4">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
             <span className="text-[11px] font-black uppercase tracking-widest">{user.name} / LVL {Math.floor(user.points / 100) + 1}</span>
          </div>
        </div>

        {!hasSubmitted ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
            {/* Left Control Panel */}
            <div className="lg:col-span-4 space-y-12">
               <div className="space-y-6">
                  <label className="text-[11px] font-black uppercase tracking-[0.4em] text-fuchsia-500 block">1. Select Drop</label>
                  <select 
                    className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 font-black uppercase italic tracking-tighter text-2xl focus:border-fuchsia-500 outline-none appearance-none cursor-pointer"
                    value={selectedDropId}
                    onChange={(e) => setSelectedDropId(e.target.value)}
                  >
                    <option value="">SELECT A DROP...</option>
                    {drops.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
               </div>

               <div className="space-y-6">
                  <label className="text-[11px] font-black uppercase tracking-[0.4em] text-fuchsia-500 block">2. Generate Script</label>
                  <div className="bg-zinc-950 border-4 border-zinc-900 p-8 min-h-[200px] relative">
                    <p className="text-xl font-bold italic text-zinc-400 leading-relaxed mb-6">
                      {isGenerating ? "Generating script..." : hypeScript || "Generate a review script to get started."}
                    </p>
                    <button 
                      onClick={handleSynthesizeHype}
                      disabled={isGenerating || !selectedDropId}
                      className="w-full bg-fuchsia-500 text-black py-4 font-black uppercase tracking-widest text-xs hover:bg-white transition-all disabled:opacity-20"
                    >
                      {isGenerating ? "GENERATING..." : "GENERATE SCRIPT"}
                    </button>
                  </div>
               </div>

               {mediaPreview && (
                 <div className="pt-8 border-t border-zinc-900">
                    <Button size="xl" className="w-full" onClick={handleSubmitCollab}>Submit to Brand</Button>
                    <p className="text-[10px] font-black uppercase text-zinc-600 mt-4 text-center tracking-widest">Your review will be sent for approval.</p>
                 </div>
               )}
            </div>

            {/* Main Production Stage */}
            <div className="lg:col-span-8 space-y-8">
               <div className="aspect-video bg-black border-8 border-zinc-900 relative overflow-hidden group shadow-2xl">
                  {isRecording ? (
                    <video ref={videoRef} muted className="w-full h-full object-cover grayscale-[30%] brightness-110" />
                  ) : mediaPreview ? (
                    <video src={mediaPreview} controls className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                       <div className="w-24 h-24 rounded-full border-4 border-dashed border-zinc-800 flex items-center justify-center">
                          <svg className="w-10 h-10 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                       </div>
                       <span className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-800">CAMERA STANDBY</span>
                    </div>
                  )}

                  {/* Overlays */}
                  <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                           {isRecording && <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />}
                           <span className="font-mono text-xs font-bold text-white/50">{isRecording ? "REC" : "STBY"}</span>
                        </div>
                        <span className="font-heading text-2xl font-black text-fuchsia-500 skew-x-[-12deg] italic opacity-50">FOODIEDROPS</span>
                     </div>
                     <div className="flex justify-between items-end border-b-2 border-white/10 pb-4">
                        <span className="font-mono text-[10px] text-white/30 tracking-widest italic">00:00:15</span>
                     </div>
                  </div>
               </div>

               <div className="flex gap-4">
                  {!isRecording && !mediaPreview && (
                    <Button size="xl" className="flex-1" onClick={startCamera}>Start Recording</Button>
                  )}
                  {isRecording && (
                    <Button size="xl" className="flex-1 bg-red-600 text-white shadow-none" onClick={stopCamera}>Stop Recording</Button>
                  )}
                  {mediaPreview && (
                    <Button size="xl" className="flex-1" variant="outline" onClick={() => setMediaPreview(null)}>Record Again</Button>
                  )}
               </div>

               <div className="grid grid-cols-3 gap-6 pt-8">
                  <div className="p-6 bg-zinc-950 border border-zinc-900 text-center space-y-2 group hover:border-fuchsia-500 transition-colors">
                     <span className="block text-[10px] font-black uppercase text-zinc-700 tracking-widest">Influence Pts</span>
                     <span className="text-3xl font-heading font-black italic">+500</span>
                  </div>
                  <div className="p-6 bg-zinc-950 border border-zinc-900 text-center space-y-2 group hover:border-fuchsia-500 transition-colors">
                     <span className="block text-[10px] font-black uppercase text-zinc-700 tracking-widest">Collab Tier</span>
                     <span className="text-3xl font-heading font-black italic">ELITE</span>
                  </div>
                  <div className="p-6 bg-zinc-950 border border-zinc-900 text-center space-y-2 group hover:border-fuchsia-500 transition-colors">
                     <span className="block text-[10px] font-black uppercase text-zinc-700 tracking-widest">Channel Bonus</span>
                     <span className="text-3xl font-heading font-black italic">15%</span>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 text-center animate-in fade-in zoom-in duration-700">
             <div className="w-32 h-32 bg-fuchsia-500 text-black flex items-center justify-center mb-10 shadow-[8px_8px_0px_0px_#fff] transform rotate-12">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M9 11l3 3L22 4m-2 1h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
             </div>
             <h2 className="font-heading text-6xl font-black italic uppercase tracking-tighter mb-4">Submitted.</h2>
             <p className="text-zinc-500 font-black uppercase tracking-[0.3em] max-w-md italic">
               Your video has been sent to the brand for review. You'll be notified upon approval.
             </p>
          </div>
        )}
      </div>
    </div>
  );
};
