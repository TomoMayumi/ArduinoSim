import React, { useMemo, useState, memo } from 'react';

export const BreakpointPanelTitle = 'ブレークポイント';
import type { BreakpointInfo } from '../emulator/DebugTypes';
import type { SourceMapper } from '../emulator/SourceMapper';

interface BreakpointPanelProps {
    breakpoints: Map<number, BreakpointInfo>;
    sourceMapper: SourceMapper;
    onUpdateCondition: (addresses: number[], condition: string) => void;
    onRemoveBreakpoints: (addresses: number[]) => void;
}

interface BpGroup {
    key: string;
    label: string;
    addresses: number[];
    enabled: boolean;
    condition: string | undefined;
}

export const BreakpointPanel: React.FC<BreakpointPanelProps> = memo(({
    breakpoints, sourceMapper, onUpdateCondition, onRemoveBreakpoints
}) => {
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const groups = useMemo(() => {
        const map = new Map<string, BpGroup>();
        
        // Ensure addresses are sorted
        const sortedAddresses = Array.from(breakpoints.keys()).sort((a, b) => a - b);
        
        for (const address of sortedAddresses) {
            const info = breakpoints.get(address)!;
            const loc = sourceMapper.getLocationForAddress(address);
            
            if (loc) {
                // Remove path and keep filename
                const shortName = loc.fileName.split('/').pop() || loc.fileName;
                const key = `${shortName}:${loc.lineNumber}`;
                if (map.has(key)) {
                    map.get(key)!.addresses.push(address);
                } else {
                    map.set(key, {
                        key,
                        label: `${shortName}:${loc.lineNumber}`,
                        addresses: [address],
                        enabled: info.enabled,
                        condition: info.condition
                    });
                }
            } else {
                const key = `asm_${address}`;
                map.set(key, {
                    key,
                    label: `0x${address.toString(16).toUpperCase()}`,
                    addresses: [address],
                    enabled: info.enabled,
                    condition: info.condition
                });
            }
        }
        return Array.from(map.values());
    }, [breakpoints, sourceMapper]);

    const startEdit = (key: string, currentCond: string = '') => {
        setEditingKey(key);
        setEditValue(currentCond);
    };

    const commitEdit = (group: BpGroup) => {
        const trimmed = editValue.trim();
        onUpdateCondition(group.addresses, trimmed);
        setEditingKey(null);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent, group: BpGroup) => {
        if (e.key === 'Enter') commitEdit(group);
        if (e.key === 'Escape') setEditingKey(null);
    };

    return (
        <div className="watch-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{groups.length}件</span>
            </div>

            <div className="watch-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {groups.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.75rem', padding: '0.5rem', textAlign: 'center' }}>
                        設定なし
                    </div>
                ) : groups.map(g => {
                    const isEditing = editingKey === g.key;

                    return (
                        <div key={g.key} className="watch-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px' }}>
                            <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div 
                                        className={g.condition ? 'bp-marker conditional' : 'bp-marker'}
                                        style={{ position: 'static', cursor: 'default' }}
                                        title={g.condition ? `条件: ${g.condition}` : '無条件'}
                                    >
                                        {g.condition && <span className="bp-condition-icon" style={{ cursor: 'default' }}>?</span>}
                                    </div>
                                    <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                        {g.label}
                                    </span>
                                </div>
                                <button
                                    className="watch-remove-btn"
                                    onClick={() => onRemoveBreakpoints(g.addresses)}
                                    title="削除"
                                >
                                    ×
                                </button>
                            </div>
                            
                            <div style={{ width: '100%', marginTop: '4px', paddingLeft: '20px', boxSizing: 'border-box' }}>
                                {isEditing ? (
                                    <input
                                        autoFocus
                                        className="watch-edit-input"
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                        placeholder="条件式を入力..."
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={e => handleEditKeyDown(e, g)}
                                        onBlur={() => commitEdit(g)}
                                    />
                                ) : (
                                    <div 
                                        style={{ 
                                            fontSize: '0.75rem', 
                                            color: g.condition ? '#93c5fd' : '#64748b',
                                            cursor: 'pointer',
                                            fontFamily: 'monospace',
                                            padding: '2px 4px',
                                            backgroundColor: 'rgba(0,0,0,0.2)',
                                            borderRadius: '3px',
                                            minHeight: '18px',
                                            wordBreak: 'break-all'
                                        }}
                                        onClick={() => startEdit(g.key, g.condition || '')}
                                        title="クリックで条件を編集"
                                    >
                                        {g.condition ? g.condition : '<条件を追加>'}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
