import { useRef, useEffect, useState, useCallback } from 'react';
import { Atmega328P } from './atmega328p';
import { SourceMapper } from './SourceMapper';
import { SourceFileManager } from './SourceFileManager';

export function useEmulator(program: Uint16Array | null, lssText: string | null = null, sourceFiles: { name: string, content: string }[] = []) {
    const [emulator, setEmulator] = useState<Atmega328P | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
    const [sourceMapper, setSourceMapper] = useState<SourceMapper>(new SourceMapper());
    const [fileManager, setFileManager] = useState<SourceFileManager>(new SourceFileManager());
    const requestRef = useRef<number>(0);

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
            const next = new Set(prev);
            if (next.has(address)) {
                next.delete(address);
            } else {
                next.add(address);
            }
            return next;
        });
    }, []);

    const toggleLineBreakpoint = useCallback((addresses: number[]) => {
        if (addresses.length === 0) return;

        const starts = getBlockStarts(addresses);
        setBreakpoints((prev) => {
            const next = new Set(prev);
            // 行内のいずれかのアドレスにBPが貼られていれば、その行のすべてのBPを解除する
            const anySet = addresses.some(addr => next.has(addr));
            if (anySet) {
                addresses.forEach(addr => next.delete(addr));
            } else {
                // そうでなければ、すべてのブロックの先頭にBPを貼る
                starts.forEach(addr => next.add(addr));
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
                    const hitAddress = emulatorRef.current.step(breakpointsRef.current);
                    if (hitAddress !== null) {
                        hitBreakpoint = true;
                        break;
                    }
                }

                if (hitBreakpoint) {
                    setIsRunning(false);
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
        start,
        stop,
        step,
        reset,
        toggleBreakpoint,
        toggleLineBreakpoint,
    };
}
