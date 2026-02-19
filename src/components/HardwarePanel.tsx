
import React, { useEffect, useState } from 'react';
import { Atmega328P } from '../emulator/atmega328p';
import { LedComponent } from '../emulator/hardware/LedComponent';
import { SwitchComponent } from '../emulator/hardware/SwitchComponent';
import { PotentiometerComponent } from '../emulator/hardware/PotentiometerComponent';
import { SevenSegmentComponent } from '../emulator/hardware/SevenSegmentComponent';
import type { ComponentState } from '../emulator/hardware/Component';
import type { SevenSegmentState } from '../emulator/hardware/SevenSegmentComponent';

interface HardwarePanelProps {
    emulator: Atmega328P | null;
}

// 7セグメントのパターン定義 (a-g)
// 1 = ON, 0 = OFF
const SEGMENT_PATTERNS: { [key: number]: number[] } = {
    0: [1, 1, 1, 1, 1, 1, 0], // a,b,c,d,e,f,g
    1: [0, 1, 1, 0, 0, 0, 0],
    2: [1, 1, 0, 1, 1, 0, 1],
    3: [1, 1, 1, 1, 0, 0, 1],
    4: [0, 1, 1, 0, 0, 1, 1],
    5: [1, 0, 1, 1, 0, 1, 1],
    6: [1, 0, 1, 1, 1, 1, 1],
    7: [1, 1, 1, 0, 0, 0, 0],
    8: [1, 1, 1, 1, 1, 1, 1],
    9: [1, 1, 1, 1, 0, 1, 1],
};

export const HardwarePanel: React.FC<HardwarePanelProps> = ({ emulator }) => {
    const [states, setStates] = useState<{ [id: string]: ComponentState }>({});

    useEffect(() => {
        if (!emulator) return;

        // 初期コンポーネントのセットアップ
        // Debug: Blue LED on D12
        if (!emulator.hardware.getComponent('led-d12')) {
            emulator.hardware.addComponent(new LedComponent('led-d12', 'Blue LED', 'D12', '#0000ff'));
        }
        // Debug: Push Button on D2
        if (!emulator.hardware.getComponent('sw-d2')) {
            emulator.hardware.addComponent(new SwitchComponent('sw-d2', 'Button', 'D2', 'momentary'));
        }
        // Debug: Potentiometer on A0
        if (!emulator.hardware.getComponent('pot-a0')) {
            emulator.hardware.addComponent(new PotentiometerComponent('pot-a0', 'Potentiometer', 'A0', 0));
        }
        // Debug: 4-Digit 7-Segment LED
        if (!emulator.hardware.getComponent('sevseg-1')) {
            emulator.hardware.addComponent(new SevenSegmentComponent('sevseg-1', '4-Digit 7-Segment'));
        }

        const interval = setInterval(() => {
            setStates(emulator.hardware.getAllStates());
        }, 50); // 20FPS更新

        return () => clearInterval(interval);
    }, [emulator]);

    const handleSwitchAction = (id: string, action: 'down' | 'up' | 'toggle') => {
        if (!emulator) return;
        const comp = emulator.hardware.getComponent(id);
        if (comp && comp.type === 'SWITCH') {
            const sw = comp as SwitchComponent;
            if (action === 'down') sw.setPressed(true);
            if (action === 'up') sw.setPressed(false);
            if (action === 'toggle') sw.toggle();
        }
    }

    const handlePotChange = (id: string, value: number) => {
        if (!emulator) return;
        const comp = emulator.hardware.getComponent(id);
        if (comp && comp.type === 'POTENTIOMETER') {
            (comp as PotentiometerComponent).setValue(value);
        }
    }

    if (!emulator) return <div>エミュレータ未接続</div>;

    return (
        <div className="hardware-panel">
            <h3>Breadboard (Hardware Components)</h3>
            <div className="components-grid">
                {emulator.hardware.getAllComponents().map(comp => {
                    const state = states[comp.id];
                    if (!state) return null;

                    if (comp.type === 'LED') {
                        const ledState = state as any;
                        const ledComp = comp as LedComponent;
                        return (
                            <div key={comp.id} className="hardware-component">
                                <span className="label">{comp.name} ({ledComp.pin})</span>
                                <div
                                    className={`hw-led ${ledState.isOn ? 'on' : ''}`}
                                    style={{
                                        '--led-color': ledState.color,
                                        boxShadow: ledState.isOn ? `0 0 10px ${ledState.color}, 0 0 20px ${ledState.color}` : 'inset 0 2px 4px rgba(0,0,0,0.5)'
                                    } as React.CSSProperties}
                                />
                            </div>
                        );
                    } else if (comp.type === 'SWITCH') {
                        const swState = state as any;
                        const swComp = comp as SwitchComponent;
                        return (
                            <div key={comp.id} className="hardware-component">
                                <span className="label">{comp.name} ({swComp.pin})</span>
                                <button
                                    className={`hw-btn ${swState.isPressed ? 'pressed' : ''}`}
                                    onMouseDown={() => swState.mode === 'momentary' && handleSwitchAction(comp.id, 'down')}
                                    onMouseUp={() => swState.mode === 'momentary' && handleSwitchAction(comp.id, 'up')}
                                    onMouseLeave={() => swState.mode === 'momentary' && handleSwitchAction(comp.id, 'up')}
                                    onClick={() => swState.mode === 'toggle' && handleSwitchAction(comp.id, 'toggle')}
                                >
                                    {swState.mode === 'momentary' ? 'PUSH' : (swState.isPressed ? 'ON' : 'OFF')}
                                </button>
                            </div>
                        );
                    } else if (comp.type === 'POTENTIOMETER') {
                        const potState = state as any;
                        const potComp = comp as PotentiometerComponent;
                        return (
                            <div key={comp.id} className="hardware-component" style={{ gridColumn: 'span 2' }}>
                                <span className="label">{comp.name} ({potComp.pin})</span>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{potState.value.toFixed(2)}V</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="5"
                                        step="0.01"
                                        value={potState.value}
                                        onChange={(e) => handlePotChange(comp.id, parseFloat(e.target.value))}
                                        className="hw-slider"
                                    />
                                </div>
                            </div>
                        );
                    } else if (comp.type === 'SEVEN_SEGMENT') {
                        const segState = state as SevenSegmentState;

                        return (
                            <div key={comp.id} className="hardware-component" style={{ gridColumn: 'span 3', background: '#000' }}>
                                <span className="label" style={{ color: '#fff' }}>{comp.name}</span>
                                <div className="seven-segment-display">
                                    {segState.digits.map((digit, idx) => (
                                        <div key={idx} className="seven-segment-digit">
                                            {/* Segments a-g */}
                                            {[0, 1, 2, 3, 4, 5, 6].map(segIdx => {
                                                const isOn = digit && digit.value !== null && SEGMENT_PATTERNS[digit.value]?.[segIdx] === 1;
                                                return (
                                                    <div
                                                        key={segIdx}
                                                        className={`segment segment-${String.fromCharCode(97 + segIdx)} ${isOn ? 'on' : ''}`}
                                                    />
                                                );
                                            })}
                                            <div className={`segment-dp ${digit?.dp ? 'on' : ''}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
            <div className="add-component-placeholder">
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>※ここに今後スイッチや7セグ等が追加されます</p>
            </div>
        </div>
    );
};
