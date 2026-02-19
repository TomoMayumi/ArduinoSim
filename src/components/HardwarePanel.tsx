
import React, { useEffect, useState } from 'react';
import { Atmega328P } from '../emulator/atmega328p';
import { LedComponent } from '../emulator/hardware/LedComponent';
import { SwitchComponent } from '../emulator/hardware/SwitchComponent';
import { PotentiometerComponent } from '../emulator/hardware/PotentiometerComponent';
import type { ComponentState } from '../emulator/hardware/Component';

interface HardwarePanelProps {
    emulator: Atmega328P | null;
}

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
                                    className={`hw - btn ${swState.isPressed ? 'pressed' : ''} `}
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
