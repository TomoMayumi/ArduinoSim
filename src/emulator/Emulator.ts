import type { BreakpointInfo } from './DebugTypes';
import type { ExpressionEvaluator } from './ExpressionEvaluator';
import { HardwareManager } from './hardware/HardwareManager';

export interface Emulator {
    cpu: any;
    hardware: HardwareManager;
    step(breakpoints: Map<number, BreakpointInfo>, evaluator?: ExpressionEvaluator): number | null;
    stepInstruction(): void;
    reset(): void;
    stop(): void;
    breakReason: string | null;
    uart?: any;
    portB?: any;
}
