import { useState, useEffect } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface RiskScoreGaugeProps {
  score: number;
  band: 'low' | 'moderate' | 'high';
  signals: string[];
}

export default function RiskScoreGauge({ score, band, signals }: RiskScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  // Semicircular Gauge math
  // Arc centered at (100, 100) with radius 80 from angle 180 (left) to 0 (right)
  // Total circumference of circle = 2 * pi * 80 = 502.65
  // Semicircle length = 251.3
  const radius = 70;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // 219.9
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  // Needle rotation: from -90 degrees (at 0 score) to +90 degrees (at 100 score)
  const rotation = -90 + (animatedScore / 100) * 180;

  const bandColors = {
    low: { text: 'text-sage-500', border: 'border-sage-100', bg: 'bg-sage-50/50' },
    moderate: { text: 'text-peach-500', border: 'border-peach-100', bg: 'bg-peach-50/50' },
    high: { text: 'text-coral-500', border: 'border-coral-100', bg: 'bg-coral-500/10' },
  };

  const currentColors = bandColors[band] || bandColors.low;

  return (
    <div className={`w-[280px] p-5 bg-white rounded-2xl border transition-all duration-300 ${currentColors.border} ${band === 'high' ? 'animate-pulse ring-2 ring-red-500/10 shadow-lg shadow-coral-500/5' : 'shadow-sm'}`}>
      <div className="flex flex-col items-center">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Health Risk Score</h3>
        
        <div className="relative w-44 h-24 flex items-center justify-center overflow-hidden">
          {/* Semicircle Track */}
          <svg className="w-full h-full transform -rotate-0" viewBox="0 0 160 100">
            <defs>
              <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6E8552" /> {/* New Sage Green */}
                <stop offset="50%" stopColor="#FF9C5F" /> {/* User Peach */}
                <stop offset="100%" stopColor="#EF4444" /> {/* Coral Red */}
              </linearGradient>
            </defs>
            {/* Background arc */}
            <path
              d="M 15 90 A 65 65 0 0 1 145 90"
              fill="none"
              stroke="#FFF9E6"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Filled arc */}
            <path
              d="M 15 90 A 65 65 0 0 1 145 90"
              fill="none"
              stroke="url(#gauge-gradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-[1200ms] ease-out"
            />
            {/* Needle center */}
            <circle cx="80" cy="90" r="6" fill="#1A291F" />
            {/* Needle pointer */}
            <line
              x1="80"
              y1="90"
              x2="80"
              y2="30"
              stroke="#1A291F"
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: '80px 90px',
              }}
              className="transition-transform duration-[1200ms] ease-out"
            />
          </svg>

          {/* Core score overlay */}
          <div className="absolute bottom-0 text-center">
            <span className="text-3xl font-black text-navy-900 tracking-tight">{Math.round(animatedScore)}</span>
            <span className="text-xs text-slate-400">/100</span>
          </div>
        </div>

        <div className={`mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${currentColors.bg} ${currentColors.text}`}>
          {band === 'low' && 'Low Risk'}
          {band === 'moderate' && 'Moderate Risk'}
          {band === 'high' && 'High Risk'}
        </div>
      </div>

      {/* Collapsible signals */}
      {signals && signals.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between text-left text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <AlertCircle size={14} className={currentColors.text} />
              What's driving this?
            </span>
            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isOpen && (
            <ul className="mt-3.5 space-y-2 text-[11px] text-slate-500 leading-normal animate-fade-in">
              {signals.map((sig, idx) => (
                <li key={idx} className="flex items-start gap-1.5 pl-1.5 border-l-2 border-slate-200">
                  {sig}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
