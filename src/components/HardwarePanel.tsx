
import React, { useEffect, useState } from 'react';
import { Atmega328P } from '../emulator/atmega328p';
import { LedComponent } from '../emulator/hardware/LedComponent';
import { SwitchComponent } from '../emulator/hardware/SwitchComponent';
import { PotentiometerComponent } from '../emulator/hardware/PotentiometerComponent';
import { MotorComponent } from '../emulator/hardware/MotorComponent';
import type { ComponentState } from '../emulator/hardware/Component';
import type { SevenSegmentState } from '../emulator/hardware/SevenSegmentComponent';
import type { MotorState } from '../emulator/hardware/MotorComponent';
import type { Lcd1602State } from '../emulator/hardware/Lcd1602Component';
import type { AdKeyboardState, AdKeyboardComponent } from '../emulator/hardware/AdKeyboardComponent';
import { loadHardwareConfigs, saveHardwareConfigs } from '../emulator/hardware/HardwareConfig';
import type { HardwareConfig } from '../emulator/hardware/HardwareConfig';
import { createComponentFromConfig } from '../emulator/hardware/ComponentFactory';
import { HardwareConfigDialog } from './HardwareConfigDialog';

interface HardwarePanelProps {
    emulator: Atmega328P | null;
    isRunning?: boolean;
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

export const HardwarePanel: React.FC<HardwarePanelProps> = ({ emulator, isRunning }) => {
    const [states, setStates] = useState<{ [id: string]: ComponentState }>({});
    const [editingConfig, setEditingConfig] = useState<HardwareConfig | null>(null);

    useEffect(() => {
        if (!emulator) return;

        // 固定コンポーネントのセットアップ（IDが存在しない場合のみ追加）
        const configs = loadHardwareConfigs();
        for (const config of configs) {
            if (!emulator.hardware.getComponent(config.id)) {
                const comp = createComponentFromConfig(config);
                if (comp) {
                    emulator.hardware.addComponent(comp);
                }
            }
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

    const openConfigFor = (id: string) => {
        const configs = loadHardwareConfigs();
        const config = configs.find(c => c.id === id);
        if (config) {
            setEditingConfig(config);
        }
    }

    const handleSaveConfig = (newConfig: HardwareConfig) => {
        if (!emulator) return;

        // localStorageに保存
        const configs = loadHardwareConfigs();
        const idx = configs.findIndex(c => c.id === newConfig.id);
        if (idx !== -1) {
            configs[idx] = newConfig;
        } else {
            configs.push(newConfig);
        }
        saveHardwareConfigs(configs);

        // メモリ上のコンポーネントを再生成
        emulator.hardware.removeComponent(newConfig.id);
        const comp = createComponentFromConfig(newConfig);
        if (comp) {
            emulator.hardware.addComponent(comp);
        }

        setEditingConfig(null);
    }

    if (!emulator) return <div>エミュレータ未接続</div>;

    // --- LED 1アイテム（グループ内子要素）を描画するヘルパー ---
    const renderLedItem = (id: string) => {
        const comp = emulator.hardware.getComponent(id);
        const state = states[id];
        if (!comp || !state || comp.type !== 'LED') {
            return (
                <div key={id} className="hw-group-item" style={{ opacity: 0.3 }}>
                    <span className="label" style={{ fontSize: '0.75rem' }}>{id}</span>
                </div>
            );
        }
        const ledState = state as any;
        const ledComp = comp as LedComponent;
        return (
            <div key={comp.id} className="hw-group-item" style={{ position: 'relative' }}>
                <button className="settings-btn" onClick={() => openConfigFor(comp.id)}>⚙️</button>
                <div
                    className={`hw-led ${ledState.isOn ? 'on' : ''}`}
                    style={{
                        '--led-color': ledState.color,
                        boxShadow: ledState.isOn ? `0 0 10px ${ledState.color}, 0 0 20px ${ledState.color}` : 'inset 0 2px 4px rgba(0,0,0,0.5)'
                    } as React.CSSProperties}
                />
                <span className="label" style={{ fontSize: '0.75rem' }}>{comp.name}<br />({ledComp.pin})</span>
            </div>
        );
    };

    // --- Switch 1アイテム（グループ内子要素）を描画するヘルパー ---
    const renderSwitchItem = (id: string) => {
        const comp = emulator.hardware.getComponent(id);
        const state = states[id];
        if (!comp || !state || comp.type !== 'SWITCH') {
            return (
                <div key={id} className="hw-group-item" style={{ opacity: 0.3 }}>
                    <span className="label" style={{ fontSize: '0.75rem' }}>{id}</span>
                </div>
            );
        }
        const swState = state as any;
        const swComp = comp as SwitchComponent;
        return (
            <div key={comp.id} className="hw-group-item" style={{ position: 'relative' }}>
                <button className="settings-btn" onClick={() => openConfigFor(comp.id)}>⚙️</button>
                <button
                    className={`hw-btn ${swState.isPressed ? 'pressed' : ''}`}
                    onMouseDown={() => swState.mode === 'momentary' && handleSwitchAction(comp.id, 'down')}
                    onMouseUp={() => swState.mode === 'momentary' && handleSwitchAction(comp.id, 'up')}
                    onMouseLeave={() => swState.mode === 'momentary' && handleSwitchAction(comp.id, 'up')}
                    onClick={() => swState.mode === 'toggle' && handleSwitchAction(comp.id, 'toggle')}
                >
                    {swState.mode === 'momentary' ? 'PUSH' : (swState.isPressed ? 'ON' : 'OFF')}
                </button>
                <span className="label" style={{ fontSize: '0.75rem' }}>{comp.name}<br />({swComp.pin})</span>
            </div>
        );
    };

    // --- 個別コンポーネント描画（LED/SWITCH以外） ---
    const renderSingleComponent = (id: string) => {
        const comp = emulator.hardware.getComponent(id);
        const state = states[id];

        if (!comp || !state) {
            return (
                <div key={id} className="hardware-component" style={{ opacity: 0.3 }}>
                    <span className="label">{id}</span>
                </div>
            );
        }

        if (comp.type === 'POTENTIOMETER') {
            const potState = state as any;
            const potComp = comp as PotentiometerComponent;
            return (
                <div key={comp.id} className="hardware-component" style={{ gridColumn: 'span 2', position: 'relative' }}>
                    <button className="settings-btn" onClick={() => openConfigFor(comp.id)}>⚙️</button>
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
                <div key={comp.id} className="hardware-component" style={{ gridColumn: 'span 3', background: '#000', position: 'relative' }}>
                    <button className="settings-btn" onClick={() => openConfigFor(comp.id)} style={{ color: 'white' }}>⚙️</button>
                    <span className="label" style={{ color: '#fff' }}>{comp.name}</span>
                    <div className="seven-segment-display">
                        {segState.digits.map((digit, idx) => {
                            const isDim = !isRunning && digit && !digit.active;
                            return (
                                <div key={idx} className="seven-segment-digit">
                                    {[0, 1, 2, 3, 4, 5, 6].map(segIdx => {
                                        const isOn = digit && digit.value !== null && SEGMENT_PATTERNS[digit.value]?.[segIdx] === 1;
                                        return (
                                            <div
                                                key={segIdx}
                                                className={`segment segment-${String.fromCharCode(97 + segIdx)} ${isOn ? (isDim ? 'dim' : 'on') : ''}`}
                                            />
                                        );
                                    })}
                                    <div className={`segment-dp ${digit?.dp ? (isDim ? 'dim' : 'on') : ''}`} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        } else if (comp.type === 'MOTOR') {
            const motorState = state as MotorState;
            const motorComp = comp as MotorComponent;
            const animationDuration = motorState.speed > 0.05 ? `${1.0 / motorState.speed}s` : '0s';
            return (
                <div key={comp.id} className="hardware-component" style={{ position: 'relative' }}>
                    <button className="settings-btn" onClick={() => openConfigFor(comp.id)}>⚙️</button>
                    <span className="label">{comp.name} ({motorComp.pin})</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className="motor-fan" style={{
                            width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #64748b',
                            position: 'relative', overflow: 'hidden', background: '#e2e8f0',
                            animation: motorState.speed > 0.05 ? `spin ${animationDuration} linear infinite` : 'none'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: '50%', width: '2px', height: '100%', background: '#334155' }}></div>
                            <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '2px', background: '#334155' }}></div>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '0.2rem' }}>{(motorState.speed * 100).toFixed(0)}%</span>
                    </div>
                </div>
            );
        } else if (comp.type === 'LCD1602') {
            const lcdState = state as Lcd1602State;
            return (
                <div key={comp.id} className="hardware-component" style={{ gridColumn: 'span 3', background: '#849b20', position: 'relative' }}>
                    <button className="settings-btn" onClick={() => openConfigFor(comp.id)}>⚙️</button>
                    <span className="label" style={{ color: '#000' }}>{comp.name}</span>
                    <div className="lcd-display" style={{
                        background: '#738618', padding: '0.5rem', borderRadius: '0.25rem', fontFamily: 'monospace',
                        color: '#000', fontSize: '1rem', lineHeight: '1.2', border: '2px solid #5a6a12',
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)', width: 'fit-content'
                    }}>
                        {lcdState.lines.map((line, row) => (
                            <div key={row} style={{ display: 'flex' }}>
                                {line.split('').map((char, col) => (
                                    <span key={col} style={{
                                        display: 'inline-block', width: '12px', height: '18px', textAlign: 'center',
                                        background: (lcdState.cursorRow === row && lcdState.cursorCol === col) ? 'rgba(0,0,0,0.3)' : 'transparent',
                                        textDecoration: (lcdState.cursorRow === row && lcdState.cursorCol === col) ? 'underline' : 'none'
                                    }}>{char}</span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            );
        } else if (comp.type === 'AD_KEYBOARD') {
            const adState = state as AdKeyboardState;
            const adComp = comp as AdKeyboardComponent;
            return (
                <div key={comp.id} className="hardware-component" style={{ gridColumn: 'span 2', position: 'relative' }}>
                    <button className="settings-btn" onClick={() => openConfigFor(comp.id)}>⚙️</button>
                    <span className="label" style={{ display: 'block', marginBottom: '0.5rem' }}>{comp.name} ({adComp.pin})</span>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {[4, 3, 2, 1].map((keyIndex) => (
                            <div key={keyIndex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <button
                                    className={`hw-btn ${adState.pressedKey === keyIndex ? 'pressed' : ''}`}
                                    style={{ width: '30px', height: '30px', padding: 0 }}
                                    onMouseDown={() => {
                                        if (emulator) {
                                            const target = emulator.hardware.getComponent(comp.id) as AdKeyboardComponent;
                                            target.setPressedKey(keyIndex as any);
                                        }
                                    }}
                                    onMouseUp={() => {
                                        if (emulator) {
                                            const target = emulator.hardware.getComponent(comp.id) as AdKeyboardComponent;
                                            target.setPressedKey(null);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        if (emulator) {
                                            const target = emulator.hardware.getComponent(comp.id) as AdKeyboardComponent;
                                            target.setPressedKey(null);
                                        }
                                    }}
                                >
                                    S{keyIndex}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="hardware-panel">
            <h3>Breadboard (Hardware Components)</h3>
            <div className="components-grid">
                {/* LED 4つをひとつの枠にまとめて横並び表示 */}
                <div className="hardware-component hw-group" style={{ gridColumn: 'span 2' }}>
                    <span className="label">LEDs</span>
                    <div className="hw-group-row">
                        {renderLedItem('led-1')}
                        {renderLedItem('led-2')}
                        {renderLedItem('led-3')}
                        {renderLedItem('led-4')}
                    </div>
                </div>

                {/* スイッチ 4つをひとつの枠にまとめて横並び表示 */}
                <div className="hardware-component hw-group" style={{ gridColumn: 'span 2' }}>
                    <span className="label">Switches</span>
                    <div className="hw-group-row">
                        {renderSwitchItem('sw-1')}
                        {renderSwitchItem('sw-2')}
                        {renderSwitchItem('sw-3')}
                        {renderSwitchItem('sw-4')}
                    </div>
                </div>

                {/* その他の固定コンポーネント（LED/SWITCH以外）を順番に表示 */}
                {renderSingleComponent('pot-1')}
                {renderSingleComponent('motor-1')}
                {renderSingleComponent('sevseg-1')}
                {renderSingleComponent('lcd-1')}
                {renderSingleComponent('adkey-1')}
            </div>
            {editingConfig && (
                <HardwareConfigDialog
                    config={editingConfig}
                    onSave={handleSaveConfig}
                    onClose={() => setEditingConfig(null)}
                />
            )}
        </div>
    );
};
