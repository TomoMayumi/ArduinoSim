import React, { useRef, useEffect, useState } from 'react';
import type { OscilloscopeState } from '../emulator/hardware/OscilloscopeComponent';

interface OscilloscopePanelProps {
    state: OscilloscopeState;
    isRunning: boolean;
    onPinChange: (channelIndex: number, pin: string) => void;
}

export const OscilloscopePanel: React.FC<OscilloscopePanelProps> = ({ state, isRunning, onPinChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [timeScale, setTimeScale] = useState(1); // 1 = 1600000 cycles total width
    const [triggerMode, setTriggerMode] = useState<'none' | 'rising' | 'falling'>('rising');

    // 表示用の設定
    const CANVAS_WIDTH = 600;
    const CANVAS_HEIGHT = 200;
    const TOTAL_CYCLES = 1600000; // 100ms at 16MHz

    const ALL_PINS = [
        'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
        'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
        'A0', 'A1', 'A2', 'A3', 'A4', 'A5'
    ];

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // クリア
        ctx.fillStyle = '#0f172a'; // ダークブルー背景
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // グリッド描画
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;

        // 垂直線
        for (let i = 0; i <= 10; i++) {
            const x = (CANVAS_WIDTH / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CANVAS_HEIGHT);
            ctx.stroke();
        }
        // 水平線
        for (let i = 0; i <= 4; i++) {
            const y = (CANVAS_HEIGHT / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CANVAS_WIDTH, y);
            ctx.stroke();
        }

        if (state.channels.length === 0) return;

        const visibleCycles = TOTAL_CYCLES / timeScale;
        
        // --- トリガ位置の計算 (全チャンネル共通) ---
        let startCycle = state.currentCycle - visibleCycles;
        
        if (triggerMode !== 'none' && state.channels.length > 0) {
            // CH1 (index 0) を基準にトリガを探す
            const masterChannel = state.channels[0];
            const samples = masterChannel.samples;
            
            if (samples.length > 1) {
                // トリガ位置（10%）から右端（100%）までをデータで埋めるために、
                // 「現在」から少なくとも 90%visibleCycles 遡った位置にあるエッジを探す
                const triggerSearchEnd = state.currentCycle - (visibleCycles * 0.9);
                const triggerSearchStart = state.currentCycle - visibleCycles * 5; // 十分遡る

                let foundTrigger = false;
                for (let i = samples.length - 1; i > 0; i--) {
                    const s1 = samples[i-1];
                    const s2 = samples[i];
                    
                    if (s2.cycle < triggerSearchStart) break;
                    if (s2.cycle > triggerSearchEnd) continue;

                    const isRising = !s1.value && s2.value;
                    const isFalling = s1.value && !s2.value;

                    if ((triggerMode === 'rising' && isRising) || (triggerMode === 'falling' && isFalling)) {
                        // トリガ位置を画面の左端10%付近にする
                        startCycle = s2.cycle - (visibleCycles * 0.1);
                        foundTrigger = true;
                        break;
                    }
                }

                // トリガが範囲内に見つからない場合、最近のエッジで妥協する（ただし右側は空白になる）
                if (!foundTrigger) {
                    for (let i = samples.length - 1; i > 0; i--) {
                        const s1 = samples[i-1];
                        const s2 = samples[i];
                        if (s2.cycle < state.currentCycle - visibleCycles) break; // ウィンドウ内には入れたい

                        const isRising = !s1.value && s2.value;
                        const isFalling = s1.value && !s2.value;

                        if ((triggerMode === 'rising' && isRising) || (triggerMode === 'falling' && isFalling)) {
                            startCycle = s2.cycle - (visibleCycles * 0.1);
                            foundTrigger = true;
                            break;
                        }
                    }
                }
            }
        }

        // 描画ロジック
        state.channels.forEach((channel, channelIdx) => {
            const samples = channel.samples;
            
            ctx.strokeStyle = channelIdx === 0 ? '#00ff00' : '#ffff00'; // 緑と黄
            ctx.lineWidth = 2;

            if (samples.length === 0) {
                // データがない場合でもピン名だけ表示
                ctx.fillStyle = ctx.strokeStyle;
                ctx.font = '10px monospace';
                const y = (channelIdx + 1) * (CANVAS_HEIGHT / (state.channels.length + 1));
                ctx.fillText(`CH${channelIdx + 1}: ${channel.pin} (No Data)`, 10, y - 5);
                return;
            };

            const getX = (cycle: number) => ((cycle - startCycle) / visibleCycles) * CANVAS_WIDTH;
            const getY = (val: boolean) => {
                const base = (channelIdx + 1) * (CANVAS_HEIGHT / (state.channels.length + 1));
                const height = CANVAS_HEIGHT / 5;
                return val ? base - height : base;
            };

            // 描画範囲外（左）の最後の状態を特定
            let currentIdx = 0;
            while(currentIdx < samples.length && getX(samples[currentIdx].cycle) < 0) {
                currentIdx++;
            }
            
            ctx.beginPath();
            let lastValue = currentIdx > 0 ? samples[currentIdx - 1].value : samples[0].value;
            ctx.moveTo(0, getY(lastValue));

            for (let i = currentIdx; i < samples.length; i++) {
                const s = samples[i];
                const x = getX(s.cycle);
                
                if (x > CANVAS_WIDTH) break;

                ctx.lineTo(x, getY(lastValue)); // 前の状態を維持して水平移動
                ctx.lineTo(x, getY(s.value));     // 垂直移動
                lastValue = s.value;
            }

            // 右端まで描画
            ctx.lineTo(CANVAS_WIDTH, getY(lastValue));
            ctx.stroke();

            // ピン名表示
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`CH${channelIdx + 1}: ${channel.pin}`, 10, getY(true) - 10);
        });

    }, [state, timeScale, triggerMode]);

    return (
        <div className="oscilloscope-panel" style={{ background: '#0f172a', padding: '1rem', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#38bdf8' }}>Oscilloscope</h3>
                
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    {state.channels.map((ch, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#1e293b', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                            <span style={{ fontSize: '0.8rem', color: idx === 0 ? '#00ff00' : '#ffff00', fontWeight: 'bold' }}>CH{idx+1}</span>
                            <select 
                                value={ch.pin} 
                                onChange={e => onPinChange(idx, e.target.value)}
                                style={{ background: '#0f172a', color: '#fff', border: '1px solid #475569', fontSize: '0.75rem', padding: '1px 4px' }}
                            >
                                {ALL_PINS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.85rem' }}>
                    <label style={{ color: '#94a3b8' }}>
                        Time: 
                        <select value={timeScale} onChange={e => setTimeScale(Number(e.target.value))} style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', marginLeft: '0.4rem' }}>
                            <option value={0.1}>x0.1</option>
                            <option value={0.5}>x0.5</option>
                            <option value={1}>x1 (100ms)</option>
                            <option value={2}>x2 (50ms)</option>
                            <option value={5}>x5 (20ms)</option>
                            <option value={10}>x10 (10ms)</option>
                            <option value={50}>x50 (2ms)</option>
                        </select>
                    </label>
                    <label style={{ color: '#94a3b8' }}>
                        Trig: 
                        <select value={triggerMode} onChange={e => setTriggerMode(e.target.value as any)} style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', marginLeft: '0.4rem' }}>
                            <option value="none">Auto</option>
                            <option value="rising">Rising</option>
                            <option value="falling">Falling</option>
                        </select>
                    </label>
                </div>
            </div>
            
            <div style={{ position: 'relative' }}>
                <canvas 
                    ref={canvasRef} 
                    width={CANVAS_WIDTH} 
                    height={CANVAS_HEIGHT} 
                    style={{ width: '100%', height: 'auto', border: '1px solid #334155', display: 'block' }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {isRunning ? '● LIVE' : '|| STOPPED'}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Horizontal: {(10 / timeScale).toFixed(1)}ms/div
                </span>
            </div>
        </div>
    );
};
