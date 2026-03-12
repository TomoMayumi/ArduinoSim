import React, { useState } from 'react';
import type { HardwareConfig } from '../emulator/hardware/HardwareConfig';

interface HardwareConfigDialogProps {
    configs: HardwareConfig[];
    onSave: (newConfigs: HardwareConfig[]) => void;
    onClose: () => void;
}

export const HardwareConfigDialog: React.FC<HardwareConfigDialogProps> = ({ configs, onSave, onClose }) => {
    // ローカル編集用コピー
    const [editedList, setEditedList] = useState<HardwareConfig[]>(configs.map(c => ({ ...c })));

    const handleChange = (index: number, field: string, value: string) => {
        setEditedList(prev => prev.map((cfg, i) =>
            i === index ? { ...cfg, [field]: value } as HardwareConfig : cfg
        ));
    };

    // ピンオプション
    const digitals = Array.from({ length: 14 }, (_, i) => `D${i}`);
    const analogs = Array.from({ length: 6 }, (_, i) => `A${i}`);
    const allPins = ['NC', ...digitals, ...analogs];
    const analogPins = ['NC', ...analogs];

    // グループ設定か単体設定かを判定
    const isGroup = configs.length > 1;
    const groupType = configs[0]?.type;
    const title = isGroup
        ? (groupType === 'LED' ? 'LEDs グループ設定' : groupType === 'SWITCH' ? 'Switches グループ設定' : '設定')
        : `設定: ${configs[0]?.name}`;

    const renderSingleConfig = (edited: HardwareConfig, index: number) => {
        const isAnalogOnly = edited.type === 'AD_KEYBOARD' || edited.type === 'POTENTIOMETER';

        return (
            <div key={edited.id} style={{
                display: 'flex', flexDirection: 'column', gap: '0.5rem',
                ...(isGroup ? {
                    padding: '0.75rem',
                    background: '#0f172a',
                    borderRadius: '0.5rem',
                    border: '1px solid #334155'
                } : {})
            }}>
                {isGroup && (
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#38bdf8' }}>{edited.name}</span>
                )}

                {('pin' in edited) && (
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        接続ピン:
                        <select value={(edited as any).pin} onChange={e => handleChange(index, 'pin', e.target.value)} style={inputStyle}>
                            {isAnalogOnly
                                ? analogPins.map(p => <option key={p} value={p}>{p === 'NC' ? '未接続 (NC)' : p}</option>)
                                : allPins.map(p => <option key={p} value={p}>{p === 'NC' ? '未接続 (NC)' : p}</option>)
                            }
                        </select>
                    </label>
                )}

                {edited.type === 'LED' && (
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        カラー:
                        <input type="color" value={(edited as any).color} onChange={e => handleChange(index, 'color', e.target.value)} style={inputStyle} />
                    </label>
                )}

                {edited.type === 'SWITCH' && (
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        モード:
                        <select value={(edited as any).mode} onChange={e => handleChange(index, 'mode', e.target.value)} style={inputStyle}>
                            <option value="momentary">Push (モーメンタリ)</option>
                            <option value="toggle">Toggle (オルタネイト)</option>
                        </select>
                    </label>
                )}

                {edited.type === 'LCD1602' && (
                    <>
                        {['rs', 'en', 'd4', 'd5', 'd6', 'd7'].map(p => (
                            <label key={p} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                {p.toUpperCase()}:
                                <select value={(edited as any)[p]} onChange={e => handleChange(index, p, e.target.value)} style={inputStyle}>
                                    {allPins.map(opt => <option key={opt} value={opt}>{opt === 'NC' ? '未接続 (NC)' : opt}</option>)}
                                </select>
                            </label>
                        ))}
                    </>
                )}

                {edited.type === 'SEVEN_SEGMENT' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        {['pinA', 'pinB', 'pinC', 'pinD', 'pinD1', 'pinD2', 'pinD3', 'pinD4', 'pinDP'].map(p => (
                            <label key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                {p.replace('pin', '')}:
                                <select value={(edited as any)[p]} onChange={e => handleChange(index, p, e.target.value)} style={{ ...inputStyle, width: '60px' }}>
                                    {allPins.map(opt => <option key={opt} value={opt}>{opt === 'NC' ? 'NC' : opt}</option>)}
                                </select>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="card" style={{ width: isGroup ? '400px' : '300px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>{title}</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {editedList.map((cfg, idx) => renderSingleConfig(cfg, idx))}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                        <button onClick={onClose} style={{ background: '#475569' }}>キャンセル</button>
                        <button onClick={() => onSave(editedList)}>保存</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const inputStyle = {
    background: '#0f172a', color: 'white', border: '1px solid #334155', borderRadius: '4px', padding: '0.2rem'
};
