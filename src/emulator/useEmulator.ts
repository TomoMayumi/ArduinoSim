import { useRef, useEffect, useState, useCallback } from 'react';
import { Atmega328P } from './atmega328p';

export function useEmulator(program: Uint16Array | null) {
    const [emulator, setEmulator] = useState<Atmega328P | null>(null);
    const [isRunning, setIsRunning] = useState(false);
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

    useEffect(() => {
        if (program) {
            const newEmulator = new Atmega328P(program);
            setEmulator(newEmulator);
        } else {
            setEmulator(null);
        }
    }, [program]);

    const isRunningRef = useRef(isRunning);
    const emulatorRef = useRef<Atmega328P | null>(null);

    useEffect(() => {
        isRunningRef.current = isRunning;
    }, [isRunning]);

    useEffect(() => {
        emulatorRef.current = emulator;
    }, [emulator]);

    useEffect(() => {
        const loop = () => {
            if (isRunningRef.current && emulatorRef.current) {
                for (let i = 0; i < 5; i++) {
                    emulatorRef.current.step();
                }
                requestRef.current = requestAnimationFrame(loop);
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
        start,
        stop,
        step,
        reset,
    };
}
