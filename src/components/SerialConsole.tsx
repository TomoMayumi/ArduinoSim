import React, { useEffect, useState, useRef } from 'react';

export const SerialConsoleTitle = 'シリアルモニター';
import { AVRUSART } from 'avr8js';

interface SerialConsoleProps {
    uart: AVRUSART | undefined;
    onReset: () => void;
    noResetMode: boolean;
}

export const SerialConsole: React.FC<SerialConsoleProps> = ({ uart, onReset, noResetMode }) => {
    const [history, setHistory] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!uart || !isConnected) return;

        uart.onByteTransmit = (value) => {
            const char = String.fromCharCode(value);
            setHistory((prev) => {
                const newHistory = [...prev];
                if (newHistory.length === 0 || char === '\n') {
                    newHistory.push(char);
                } else {
                    newHistory[newHistory.length - 1] += char;
                }
                return newHistory.slice(-100); // 100 lines history
            });
        };

        return () => {
            uart.onByteTransmit = null;
        };
    }, [uart, isConnected]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    const handleSend = () => {
        if (uart && input) {
            for (let i = 0; i < input.length; i++) {
                uart.writeByte(input.charCodeAt(i));
            }
            uart.writeByte(10); // Newline
            setInput('');
        }
    };

    const toggleConnect = () => {
        if (!isConnected) {
            if (!noResetMode) {
                onReset(); // DTR-reset behavior
            }
            setIsConnected(true);
        } else {
            setIsConnected(false);
        }
    };

    return (
        <div className="serial-console">
            <div className="serial-header" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.4rem', marginTop: '-0.2rem' }}>
                <button onClick={toggleConnect} className={isConnected ? 'connected' : ''} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                    {isConnected ? '切断' : '接続'}
                </button>
            </div>
            <div className="serial-history" ref={scrollRef}>
                {history.map((line, i) => (
                    <div key={i}>{line}</div>
                ))}
            </div>
            <div className="serial-input" style={{ gap: '0.25rem' }}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="送信..."
                    disabled={!isConnected}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                />
                <button onClick={handleSend} disabled={!isConnected} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>送信</button>
            </div>
        </div>
    );
};
