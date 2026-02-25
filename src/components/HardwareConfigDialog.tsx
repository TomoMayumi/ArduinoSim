import React, { useState } from 'react';
import type { HardwareConfig } from '../emulator/hardware/HardwareConfig';

interface HardwareConfigDialogProps {
    config: HardwareConfig;
    onSave: (newConfig: HardwareConfig) => void;
    onClose: () => void;
}

export const HardwareConfigDialog: React.FC<HardwareConfigDialogProps> = ({ config, onSave, onClose }) => {
    // Make a local editable copy
    const [edited, setEdited] = useState<HardwareConfig>({ ...config });

    const handleChange = (field: string, value: string) => {
        setEdited({ ...edited, [field]: value } as HardwareConfig);
    }

    // Common pin options
    const digitals = Array.from({ length: 14 }, (_, i) => `D${i}`);
    const analogs = Array.from({ length: 6 }, (_, i) => `A${i}`);
    const allPins = ['NC', ...digitals, ...analogs];
    const analogPins = ['NC', ...analogs];

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="card" style={{ width: '300px', padding: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>設定: {config.name}</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {('pin' in edited) && (
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            接続ピン:
                            <select value={(edited as any).pin} onChange={e => handleChange('pin', e.target.value)} style={inputStyle}>
                                {config.type === 'AD_KEYBOARD' || config.type === 'POTENTIOMETER'
                                    ? analogPins.map(p => <option key={p} value={p}>{p === 'NC' ? '未接続 (NC)' : p}</option>)
                                    : allPins.map(p => <option key={p} value={p}>{p === 'NC' ? '未接続 (NC)' : p}</option>)
                                }
                            </select>
                        </label>
                    )}

                    {config.type === 'LED' && (
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            カラー:
                            <input type="color" value={(edited as any).color} onChange={e => handleChange('color', e.target.value)} style={inputStyle} />
                        </label>
                    )}

                    {config.type === 'SWITCH' && (
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                            モード:
                            <select value={(edited as any).mode} onChange={e => handleChange('mode', e.target.value)} style={inputStyle}>
                                <option value="momentary">Push (モーメンタリ)</option>
                                <option value="toggle">Toggle (オルタネイト)</option>
                            </select>
                        </label>
                    )}

                    {config.type === 'LCD1602' && (
                        <>
                            {['rs', 'en', 'd4', 'd5', 'd6', 'd7'].map(p => (
                                <label key={p} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    {p.toUpperCase()}:
                                    <select value={(edited as any)[p]} onChange={e => handleChange(p, e.target.value)} style={inputStyle}>
                                        {allPins.map(opt => <option key={opt} value={opt}>{opt === 'NC' ? '未接続 (NC)' : opt}</option>)}
                                    </select>
                                </label>
                            ))}
                        </>
                    )}

                    {config.type === 'SEVEN_SEGMENT' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {['pinA', 'pinB', 'pinC', 'pinD', 'pinD1', 'pinD2', 'pinD3', 'pinD4', 'pinDP'].map(p => (
                                <label key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    {p.replace('pin', '')}:
                                    <select value={(edited as any)[p]} onChange={e => handleChange(p, e.target.value)} style={{ ...inputStyle, width: '60px' }}>
                                        {allPins.map(opt => <option key={opt} value={opt}>{opt === 'NC' ? 'NC' : opt}</option>)}
                                    </select>
                                </label>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                        <button onClick={onClose} style={{ background: '#475569' }}>キャンセル</button>
                        <button onClick={() => onSave(edited)}>保存</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const inputStyle = {
    background: '#0f172a', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '0.2rem'
};
