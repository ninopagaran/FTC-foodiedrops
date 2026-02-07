
import React, { useEffect, useState } from "react";

interface CountdownProps {
  targetDate: string;
  prefix?: string;
  className?: string;
}

export const Countdown: React.FC<CountdownProps> = ({ targetDate, prefix = '', className = '' }) => {
  const calculateTimeLeft = () => {
    const difference = new Date(targetDate).getTime() - new Date().getTime();

    if (difference <= 0) return null;

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) {
    return null;
  }

  const format = (t: {days: number, hours:number, minutes:number, seconds:number}) => {
    const parts = [];
    if (t.days > 0) parts.push(`${t.days}d`);
    parts.push(`${String(t.hours).padStart(2, '0')}h`);
    parts.push(`${String(t.minutes).padStart(2, '0')}m`);
    parts.push(`${String(t.seconds).padStart(2, '0')}s`);
    return parts.join(':');
  }

  // Default to small text if no size class is provided, but allow overrides
  const defaultClasses = "font-mono font-black uppercase tracking-widest";
  const finalClass = className.includes('text-') ? `${defaultClasses} ${className}` : `${defaultClasses} text-[11px] ${className}`;

  return (
    <div className={finalClass}>
      {prefix && <span className="mr-1">{prefix}</span>}
      {format(timeLeft)}
    </div>
  );
};
