import { useRef, useEffect, useState, useCallback } from 'react';
import { Atmega328P } from './atmega328p';
import { SourceMapper } from './SourceMapper';
import { SourceFileManager } from './SourceFileManager';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import type { BreakpointInfo, WatchExpression, WatchResult, DebugVariable } from './DebugTypes';

export function useEmulator(program: Uint16Array | null, lssText: string | null = null, sourceFiles: { name: string, content: string }[] = [], debugVariables: DebugVariable[] = []) {
    const [emulator, setEmulator] = useState<Atmega328P | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [breakpoints, setBreakpoints] = useState<Map<number, BreakpointInfo>>(new Map());
    const [sourceMapper, setSourceMapper] = useState<SourceMapper>(new SourceMapper());
    const [fileManager, setFileManager] = useState<SourceFileManager>(new SourceFileManager());
    const requestRef = useRef<number>(0);
    const [breakpointError, setBreakpointError] = useState<string | null>(null);

    // ウォッチ式
    const [watchExpressions, setWatchExpressions] = useState<WatchExpression[]>([]);
    const [watchResults, setWatchResults] = useState<WatchResult[]>([]);

    // 式評価エンジン
    const evaluatorRef = useRef<ExpressionEvaluator>(new ExpressionEvaluator(debugVariables));

    // デバッグ変数が変わったら評価エンジンを更新
    useEffect(() => {
        evaluatorRef.current.setVariables(debugVariables);
    }, [debugVariables]);

    const start = useCallback(() => {
        if (emulator) {
            setIsRunning(true);
        }
    }, [emulator]);

    const stop = useCallback(() => {
        setIsRunning(false);
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
    }, []);

    const reset = useCallback(() => {
        if (emulator) {
            emulator.reset();
        }
    }, [emulator]);

    const toggleBreakpoint = useCallback((address: number) => {
        setBreakpoints((prev) => {
            const next = new Map(prev);
            if (next.has(address)) {
                next.delete(address);
            } else {
                next.set(address, { enabled: true });
            }
            return next;
        });
    }, []);

    const toggleLineBreakpoint = useCallback((addresses: number[]) => {
        if (addresses.length === 0) return;

        const starts = getBlockStarts(addresses);
        setBreakpoints((prev) => {
            const next = new Map(prev);
            // 行内のいずれかのアドレスにBPが貼られていれば、その行のすべてのBPを解除する
            const anySet = addresses.some(addr => next.has(addr));
            if (anySet) {
                addresses.forEach(addr => next.delete(addr));
            } else {
                // そうでなければ、すべてのブロックの先頭にBPを貼る
                starts.forEach(addr => next.set(addr, { enabled: true }));
            }
            return next;
        });
    }, []);

    const removeBreakpoints = useCallback((addresses: number[]) => {
        setBreakpoints((prev) => {
            const next = new Map(prev);
            addresses.forEach(addr => next.delete(addr));
            return next;
        });
    }, []);

    /** ブレークポイントに条件を設定 */
    const updateBreakpointCondition = useCallback((addresses: number[], condition: string) => {
        if (condition && condition.trim() !== '') {
            if (evaluatorRef.current && emulatorRef.current) {
                const result = evaluatorRef.current.tryEvaluate(condition, emulatorRef.current.cpu, emulatorRef.current.cpu.pc);
                if (result.error) {
                    const proceed = window.confirm(`【警告】条件式の評価エラー\n\n${result.error}\n\n存在しない変数名（ローカル変数など）や不正な構文が含まれている可能性があります。このまま設定すると、実行時にエラーとなって都度停止します。設定を続行しますか？`);
                    if (!proceed) return;
                }
            }
        }

        const starts = getBlockStarts(addresses);
        setBreakpoints((prev) => {
            const next = new Map(prev);
            for (const address of starts) {
                const existing = next.get(address);
                if (existing) {
                    next.set(address, { ...existing, condition: condition || undefined });
                } else {
                    next.set(address, { enabled: true, condition: condition || undefined });
                }
            }
            return next;
        });
    }, []);

    function getBlockStarts(addresses: number[]): number[] {
        if (addresses.length === 0) return [];
        const sorted = [...addresses].sort((a, b) => a - b);
        const starts = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            // AVRの命令サイズ（2 or 4バイト）を考慮し、4バイトを超える隙間があれば別ブロックとみなす
            if (sorted[i] > sorted[i - 1] + 4) {
                starts.push(sorted[i]);
            }
        }
        return starts;
    }

    useEffect(() => {
        if (program) {
            const newEmulator = new Atmega328P(program);
            setEmulator(newEmulator);
        } else {
            setEmulator(null);
        }
    }, [program]);

    useEffect(() => {
        const fm = new SourceFileManager();
        for (const file of sourceFiles) {
            fm.addFile(file.name, file.content);
        }

        const mapper = new SourceMapper();
        if (lssText) {
            mapper.parseLss(lssText, fm);
        }

        setFileManager(fm);
        setSourceMapper(mapper);
    }, [lssText, sourceFiles]);

    const isRunningRef = useRef(isRunning);
    const emulatorRef = useRef<Atmega328P | null>(null);
    const breakpointsRef = useRef(breakpoints);

    useEffect(() => {
        isRunningRef.current = isRunning;
    }, [isRunning]);

    useEffect(() => {
        emulatorRef.current = emulator;
    }, [emulator]);

    useEffect(() => {
        breakpointsRef.current = breakpoints;
    }, [breakpoints]);

    useEffect(() => {
        const loop = () => {
            if (isRunningRef.current && emulatorRef.current) {
                // Breakpoint check logic
                let hitBreakpoint = false;
                for (let i = 0; i < 5; i++) {
                    const hitAddress = emulatorRef.current.step(breakpointsRef.current, evaluatorRef.current);
                    if (hitAddress !== null) {
                        hitBreakpoint = true;
                        break;
                    }
                }

                if (hitBreakpoint) {
                    setIsRunning(false);
                    if (emulatorRef.current.breakReason) {
                        setBreakpointError(emulatorRef.current.breakReason);
                        emulatorRef.current.breakReason = null;
                    } else {
                        setBreakpointError(null);
                    }
                } else {
                    requestRef.current = requestAnimationFrame(loop);
                }
            }
        };

        if (isRunning) {
            requestRef.current = requestAnimationFrame(loop);
        }

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [isRunning, emulator]); // Re-run effect when isRunning or emulator instance changes

    // ウォッチ式の評価（停止中に自動評価）
    const evaluateWatches = useCallback(() => {
        if (!emulator || isRunning) {
            setWatchResults(watchExpressions.map(w => ({
                id: w.id,
                expression: w.expression,
                value: null,
                format: w.format,
                error: isRunning ? '実行中...' : 'エミュレータ未接続'
            })));
            return;
        }

        const results = watchExpressions.map(w => {
            const result = evaluatorRef.current.tryEvaluate(w.expression, emulator.cpu, emulator.cpu.pc);
            return {
                id: w.id,
                expression: w.expression,
                value: result.value,
                error: result.error,
                format: w.format,
            };
        });
        setWatchResults(results);
    }, [emulator, isRunning, watchExpressions]);

    // emulatorの状態が変化したらウォッチを再評価
    useEffect(() => {
        evaluateWatches();
    }, [evaluateWatches, emulator, isRunning]);

    const addWatch = useCallback((expression: string) => {
        const id = `watch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        setWatchExpressions(prev => [...prev, { id, expression, format: 'hex' }]);
    }, []);

    const removeWatch = useCallback((id: string) => {
        setWatchExpressions(prev => prev.filter(w => w.id !== id));
    }, []);

    const updateWatchExpression = useCallback((id: string, expression: string) => {
        setWatchExpressions(prev => prev.map(w => w.id === id ? { ...w, expression } : w));
    }, []);

    const updateWatchFormat = useCallback((id: string, format: 'hex' | 'dec' | 'bin') => {
        setWatchExpressions(prev => prev.map(w => w.id === id ? { ...w, format } : w));
    }, []);

    const step = useCallback(() => {
        if (emulator && !isRunning) {
            emulator.stepInstruction();
            // Force a state update to refresh UI
            setEmulator(Object.create(Object.getPrototypeOf(emulator), Object.getOwnPropertyDescriptors(emulator)));
            setIsRunning(false);
        }
    }, [emulator, isRunning]);

    return {
        emulator,
        isRunning,
        breakpoints,
        sourceMapper,
        fileManager,
        watchExpressions,
        watchResults,
        start,
        stop,
        step,
        reset,
        toggleBreakpoint,
        toggleLineBreakpoint,
        removeBreakpoints,
        updateBreakpointCondition,
        addWatch,
        removeWatch,
        updateWatchExpression,
        updateWatchFormat,
        breakpointError,
        setBreakpointError,
    };
}
