import React, { memo, useState, useRef } from 'react';
import type { WatchExpression, WatchResult } from '../emulator/DebugTypes';

interface WatchPanelProps {
    watchExpressions: WatchExpression[];
    watchResults: WatchResult[];
    onAddWatch: (expression: string) => void;
    onRemoveWatch: (id: string) => void;
    onUpdateExpression: (id: string, expression: string) => void;
    onUpdateFormat: (id: string, format: 'hex' | 'dec' | 'bin') => void;
}

const FORMAT_LABELS: Record<string, string> = { hex: 'HEX', dec: 'DEC', bin: 'BIN' };
const FORMAT_CYCLE: ('hex' | 'dec' | 'bin')[] = ['hex', 'dec', 'bin'];

const formatValue = (val: number, fmt: string, size: number = 1): string => {
    const bitWidth = size * 8;
    switch (fmt) {
        case 'hex': {
            const digits = Math.ceil(bitWidth / 4);
            return '0x' + (val >>> 0).toString(16).toUpperCase().padStart(digits, '0');
        }
        case 'dec': return val.toString(10);
        case 'bin': return '0b' + (val >>> 0).toString(2).padStart(Math.min(bitWidth, 16), '0');
        default: return val.toString();
    }
};

export const WatchPanel: React.FC<WatchPanelProps> = memo(({
    watchExpressions, watchResults, onAddWatch, onRemoveWatch, onUpdateExpression, onUpdateFormat
}) => {
    const [newExpr, setNewExpr] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleAdd = () => {
        const expr = newExpr.trim();
        if (expr) {
            onAddWatch(expr);
            setNewExpr('');
        }
    };

    const handleAddKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleAdd();
    };

    const startEdit = (id: string, currentExpr: string) => {
        setEditingId(id);
        setEditValue(currentExpr);
    };

    const commitEdit = (id: string) => {
        const trimmed = editValue.trim();
        if (trimmed) {
            onUpdateExpression(id, trimmed);
        }
        setEditingId(null);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === 'Enter') commitEdit(id);
        if (e.key === 'Escape') setEditingId(null);
    };

    // 結果をidでマップ
    const resultMap = new Map(watchResults.map(r => [r.id, r]));

    return (
        <div className="watch-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <h4 style={{ margin: 0, color: '#cbd5e1', fontSize: '0.8rem' }}>ウォッチ</h4>
            </div>

            {/* ウォッチ式リスト */}
            <div className="watch-list">
                {watchExpressions.map(w => {
                    const result = resultMap.get(w.id);
                    const isEditing = editingId === w.id;

                    return (
                        <div key={w.id} className="watch-row">
                            <div className="watch-expr">
                                {isEditing ? (
                                    <input
                                        autoFocus
                                        className="watch-edit-input"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={e => handleEditKeyDown(e, w.id)}
                                        onBlur={() => commitEdit(w.id)}
                                    />
                                ) : (
                                    <span
                                        className="watch-expr-text"
                                        onDoubleClick={() => startEdit(w.id, w.expression)}
                                        title="ダブルクリックで編集"
                                    >
                                        {w.expression}
                                    </span>
                                )}
                            </div>
                            <div className="watch-value">
                                {result?.error ? (
                                    <span className="watch-error" title={result.error}>
                                        {result.error}
                                    </span>
                                ) : result?.value !== null && result?.value !== undefined ? (
                                    <span
                                        className="watch-val-text"
                                        onClick={() => {
                                            const nextFmt = FORMAT_CYCLE[(FORMAT_CYCLE.indexOf(w.format) + 1) % FORMAT_CYCLE.length];
                                            onUpdateFormat(w.id, nextFmt);
                                        }}
                                        title={`クリックで形式切替 (${FORMAT_LABELS[w.format]})`}
                                    >
                                        {formatValue(result.value, w.format)}
                                    </span>
                                ) : (
                                    <span className="watch-no-value">—</span>
                                )}
                            </div>
                            <button
                                className="watch-remove-btn"
                                onClick={() => onRemoveWatch(w.id)}
                                title="削除"
                            >
                                ×
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 追加入力 */}
            <div className="watch-add-row">
                <input
                    ref={inputRef}
                    className="watch-add-input"
                    value={newExpr}
                    onChange={e => setNewExpr(e.target.value)}
                    onKeyDown={handleAddKeyDown}
                    placeholder="式を追加... (例: counter, r16, PORTB)"
                />
                <button
                    className="watch-add-btn"
                    onClick={handleAdd}
                    disabled={!newExpr.trim()}
                    title="ウォッチ追加"
                >
                    +
                </button>
            </div>
        </div>
    );
});
