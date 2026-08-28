import React from 'react';
import { Calculator } from 'lucide-react';

export const evaluateMathExpression = (input: string, baseValue: number): number | null => {
    const sanitized = input.replace(/\s+/g, '');
    
    if (sanitized.startsWith('+') || sanitized.startsWith('-')) {
        try {
            const delta = parseInt(sanitized, 10);
            if (!isNaN(delta)) {
                return Math.max(0, baseValue + delta);
            }
        } catch (e) {}
    }
    
    if (/^\d+[\+\-]\d+$/.test(sanitized)) {
        try {
            const match = sanitized.match(/^(\d+)([\+\-])(\d+)$/);
            if (match) {
                const op1 = parseInt(match[1], 10);
                const sign = match[2];
                const op2 = parseInt(match[3], 10);
                if (sign === '+') return op1 + op2;
                if (sign === '-') return Math.max(0, op1 - op2);
            }
        } catch (e) {}
    }
    
    const parsedInt = parseInt(sanitized, 10);
    if (!isNaN(parsedInt)) return Math.max(0, parsedInt);
    return null;
};

interface QuickCalculatorPanelProps {
    onUpdate: (amount: number) => void;
    label?: string;
}

export const QuickCalculatorPanel: React.FC<QuickCalculatorPanelProps> = ({ onUpdate, label = "Quick Calculator" }) => {
    return (
        <div className="absolute left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 top-10 bg-cool-gray-900 border border-cool-gray-750 rounded-lg shadow-2xl p-2.5 z-50 w-52 space-y-2 text-left">
            <p className="text-[10px] uppercase tracking-wider text-cool-gray-400 font-bold flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-cyan-400" /> {label}
            </p>
            
            <div className="grid grid-cols-4 gap-1">
                {['+1', '+5', '+10', '+20'].map(val => (
                    <button 
                        key={val} 
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onUpdate(parseInt(val, 10));
                        }}
                        className="text-[11px] py-1 bg-cyan-950 border border-cyan-800/80 hover:bg-cyan-600 hover:text-white text-cyan-200 rounded font-bold transition"
                    >
                        {val}
                    </button>
                ))}
            </div>
            
            <div className="grid grid-cols-4 gap-1">
                {['-1', '-5', '-6', '-10'].map(val => (
                    <button 
                        key={val} 
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onUpdate(parseInt(val, 10));
                        }}
                        className="text-[11px] py-1 bg-red-950 border border-red-900/60 hover:bg-red-600 hover:text-white text-red-300 rounded font-bold transition"
                    >
                        {val}
                    </button>
                ))}
            </div>
        </div>
    );
};
