import React, { useEffect, useState } from 'react';
import { Atmega328P } from '../emulator/atmega328p';
import { LedComponent } from '../emulator/hardware/LedComponent';
import type { ComponentState } from '../emulator/hardware/Component';

interface HardwarePanelProps {
    emulator: Atmega328P | null;
}

export const HardwarePanel: React.FC<HardwarePanelProps> = ({ emulator }) => {
    const [states, setStates] = useState<{ [id: string]: ComponentState }>({});

    useEffect(() => {
        if (!emulator) return;

        // 初期コンポーネントのセットアップ (テスト用: D12に青色LED)
        if (!emulator.hardware.getComponent('led-d12')) {
            emulator.hardware.addComponent(new LedComponent('led-d12', 'Blue LED', 'D12', '#0000ff'));
        }

        const interval = setInterval(() => {
            setStates(emulator.hardware.getAllStates());
        }, 50); // 20FPS更新

        return () => clearInterval(interval);
    }, [emulator]);

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
