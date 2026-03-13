import React, { useRef, useEffect, useState } from 'react';
import type { OscilloscopeState } from '../emulator/hardware/OscilloscopeComponent';

interface OscilloscopePanelProps {
    state: OscilloscopeState;
    isRunning: boolean;
    onPinChange: (channelIndex: number, pin: string) => void;
}

export const OscilloscopePanel: React.FC<OscilloscopePanelProps> = ({ state, isRunning, onPinChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [timeScale, setTimeScale] = useState(1); // Reference: 1 = 100ms total
    const [displayChannelCount, setDisplayChannelCount] = useState(4); // デフォルト4CH表示
    const [triggerMode, setTriggerMode] = useState<'none' | 'auto' | 'single'>('auto');
    const [triggerEdge, setTriggerEdge] = useState<'rising' | 'falling' | 'both'>('rising');
    const [triggerChannel, setTriggerChannel] = useState(0); // 0-indexed
    const [isArmed, setIsArmed] = useState(false);
    const [frozenState, setFrozenState] = useState<{ state: OscilloscopeState, startCycle: number } | null>(null);

    // 表示用の設定
    const CANVAS_WIDTH = 640;
    const CANVAS_HEIGHT = 320;
    const TOTAL_CYCLES_REF = 1600000; // 100ms at 16MHz

    const ALL_PINS = [
        'None',
        'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
        'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
        'A0', 'A1', 'A2', 'A3', 'A4', 'A5'
    ];

    const TIME_OPTIONS = [
        { label: '200ms', value: 0.5 },
        { label: '100ms', value: 1 },
        { label: '50ms', value: 2 },
        { label: '20ms', value: 5 },
        { label: '10ms', value: 10 },
        { label: '5ms', value: 20 },
        { label: '2ms', value: 50 },
        { label: '1ms', value: 100 },
        { label: '500μs', value: 200 },
        { label: '200μs', value: 500 },
        { label: '100μs', value: 1000 },
        { label: '50μs', value: 2000 },
        { label: '20μs', value: 5000 },
        { label: '10μs', value: 10000 },
    ];

    const channelColors = ['#00ff00', '#ffff00', '#00ffff', '#ff00ff', '#ffffff', '#ff8000', '#80ff00', '#0080ff'];

    useEffect(() => {
        if (triggerMode === 'single') {
            setIsArmed(true);
            setFrozenState(null);
        }
    }, [triggerMode, triggerChannel, triggerEdge]);

    useEffect(() => {
        if (triggerChannel >= displayChannelCount) {
            setTriggerChannel(0);
        }
    }, [displayChannelCount, triggerChannel]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let currentState = state;
        let currentStartCycle: number | null = null;
        const visibleCycles = TOTAL_CYCLES_REF / timeScale;

        const checkTrigger = (s1: { value: boolean }, s2: { value: boolean }) => {
            if (triggerEdge === 'rising') return !s1.value && s2.value;
            if (triggerEdge === 'falling') return s1.value && !s2.value;
            return s1.value !== s2.value; // both
        };

        if (triggerMode === 'single') {
            if (frozenState) {
                currentState = frozenState.state;
                currentStartCycle = frozenState.startCycle;
            } else if (isArmed && state.channels[triggerChannel]) {
                const triggerSource = state.channels[triggerChannel];
                const samples = triggerSource.samples;
                if (samples.length > 1) {
                    const searchEnd = state.currentCycle - (visibleCycles * 0.9);
                    const searchStart = state.currentCycle - visibleCycles * 8;
                    for (let i = samples.length - 1; i > 0; i--) {
                        const s1 = samples[i-1];
                        const s2 = samples[i];
                        if (s2.cycle < searchStart) break;
                        if (s2.cycle > searchEnd) continue;
                        if (checkTrigger(s1, s2)) {
                            setFrozenState({ state, startCycle: s2.cycle - (visibleCycles * 0.1) });
                            setIsArmed(false);
                            break;
                        }
                    }
                }
            }
        }

        const renderState = currentState;
        let startCycle = currentStartCycle ?? (renderState.currentCycle - visibleCycles);
        
        if (triggerMode === 'auto' && renderState.channels[triggerChannel]) {
            const triggerSource = renderState.channels[triggerChannel];
            const samples = triggerSource.samples;
            if (samples.length > 1) {
                const searchEnd = renderState.currentCycle - (visibleCycles * 0.9);
                const searchStart = renderState.currentCycle - visibleCycles * 8;
                let found = false;
                for (let i = samples.length - 1; i > 0; i--) {
                    const s1 = samples[i-1];
                    const s2 = samples[i];
                    if (s2.cycle < searchStart) break;
                    if (s2.cycle > searchEnd) continue;
                    if (checkTrigger(s1, s2)) {
                        startCycle = s2.cycle - (visibleCycles * 0.1);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    // Fallback to latest activity if no stable trigger in window
                    for (let i = samples.length - 1; i > 0; i--) {
                        const s1 = samples[i-1];
                        const s2 = samples[i];
                        if (s2.cycle < renderState.currentCycle - visibleCycles) break;
                        if (checkTrigger(s1, s2)) {
                            startCycle = s2.cycle - (visibleCycles * 0.1);
                            found = true;
                            break;
                        }
                    }
                }
            }
        }

        // Render
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = (CANVAS_WIDTH / 10) * i;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
        }
        for (let i = 0; i <= displayChannelCount; i++) {
            const y = (CANVAS_HEIGHT / displayChannelCount) * i;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
        }



        renderState.channels.slice(0, displayChannelCount).forEach((channel, idx) => {
            if (channel.pin === 'None') return;
            const samples = channel.samples;
            ctx.strokeStyle = channelColors[idx % channelColors.length];
            ctx.lineWidth = 2;

            const getX = (cycle: number) => ((cycle - startCycle) / visibleCycles) * CANVAS_WIDTH;
            const getY = (val: boolean) => {
                const channelHeight = CANVAS_HEIGHT / displayChannelCount;
                const base = (idx + 1) * channelHeight;
                const amplitude = channelHeight * 0.7;
                return val ? base - amplitude : base - channelHeight * 0.1;
            };

            if (samples.length === 0) return;

            let currentIdx = 0;
            while(currentIdx < samples.length && getX(samples[currentIdx].cycle) < 0) currentIdx++;
            
            ctx.beginPath();
            let lastValue = currentIdx > 0 ? samples[currentIdx - 1].value : samples[0].value;
            ctx.moveTo(0, getY(lastValue));

            for (let i = currentIdx; i < samples.length; i++) {
                const s = samples[i];
                const x = getX(s.cycle);
                if (x > CANVAS_WIDTH) break;
                ctx.lineTo(x, getY(lastValue));
                ctx.lineTo(x, getY(s.value));
                lastValue = s.value;
            }
            ctx.lineTo(CANVAS_WIDTH, getY(lastValue));
            ctx.stroke();
        });

        // Trigger Marker
        if (triggerMode !== 'none') {
            ctx.strokeStyle = '#ef4444'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH * 0.1, 0); ctx.lineTo(CANVAS_WIDTH * 0.1, CANVAS_HEIGHT); ctx.stroke();
            ctx.setLineDash([]);
        }

    }, [state, timeScale, triggerMode, triggerEdge, triggerChannel, isArmed, frozenState, displayChannelCount]);

    return (
        <div className="oscilloscope-panel" style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '1.2rem' }}>O</span>SCILLOSCOPE
                        <span style={{ fontSize: '0.7rem', background: '#38bdf8', color: '#0f172a', padding: '1px 4px', borderRadius: '3px' }}>8CH</span>
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: '#0f172a', padding: '0.5rem', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Channels</label>
                            <select 
                                value={displayChannelCount} onChange={e => setDisplayChannelCount(Number(e.target.value))}
                                style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '2px', fontSize: '0.8rem' }}
                            >
                                <option value={1}>1 CH</option>
                                <option value={2}>2 CH</option>
                                <option value={4}>4 CH</option>
                                <option value={8}>8 CH</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Time/Div</label>
                            <select 
                                value={timeScale} onChange={e => setTimeScale(Number(e.target.value))}
                                style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '2px', fontSize: '0.8rem' }}
                            >
                                {TIME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>

                        <div style={{ width: '1px', height: '20px', background: '#1e293b', margin: '0 0.5rem' }}></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Mode:</span>
                            <select value={triggerMode} onChange={e => setTriggerMode(e.target.value as any)} style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', fontSize: '0.8rem', padding: '2px', borderRadius: '4px' }}>
                                <option value="none">Off</option>
                                <option value="auto">Auto</option>
                                <option value="single">Single</option>
                            </select>
                        </div>
                        {triggerMode !== 'none' && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Src:</span>
                                    <select value={triggerChannel} onChange={e => setTriggerChannel(Number(e.target.value))} style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', fontSize: '0.8rem', padding: '2px', borderRadius: '4px' }}>
                                        {state.channels.slice(0, displayChannelCount).map((_, i) => <option key={i} value={i}>CH{i+1}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Edge:</span>
                                    <select value={triggerEdge} onChange={e => setTriggerEdge(e.target.value as any)} style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', fontSize: '0.8rem', padding: '2px', borderRadius: '4px' }}>
                                        <option value="rising">Rising</option>
                                        <option value="falling">Falling</option>
                                        <option value="both">Both</option>
                                    </select>
                                </div>
                            </>
                        )}
                        {triggerMode === 'single' && (
                            <button 
                                onClick={() => { setIsArmed(true); setFrozenState(null); }}
                                style={{ background: isArmed ? '#ef4444' : '#10b981', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                {isArmed ? 'ARMED' : 'ARM'}
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0', alignItems: 'stretch', background: '#000', borderRadius: '6px', overflow: 'hidden', border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '60px', background: '#0f172a', flexShrink: 0 }}>
                        {state.channels.slice(0, displayChannelCount).map((ch, idx) => (
                            <div key={idx} style={{ 
                                flex: 1, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                padding: '0 0.25rem',
                                borderBottom: idx < displayChannelCount - 1 ? '1px solid #1e293b' : 'none'
                             }}>
                                <span style={{ color: channelColors[idx % 8], fontWeight: 'bold', fontSize: '0.75rem', marginBottom: '2px' }}>CH{idx+1}</span>
                                <select 
                                    value={ch.pin} 
                                    onChange={e => onPinChange(idx, e.target.value)}
                                    style={{ background: '#1e293b', color: '#fff', border: 'none', fontSize: '0.7rem', width: '100%', padding: '2px 0', textAlign: 'center' }}
                                >
                                    {ALL_PINS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div style={{ flex: 1, position: 'relative', display: 'flex', minWidth: 0 }}>
                        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'fill' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <span style={{ color: isRunning ? '#10b981' : '#64748b' }}>{isRunning ? '● RUNNING' : '|| STOPPED'}</span>
                        {triggerMode === 'single' && <span>{isArmed ? 'WAITING TRIGGER' : 'CAPTURED'}</span>}
                    </div>
                    <span>Resolution: 62.5ns/cycle</span>
                </div>
            </div>
        </div>
    );
};
