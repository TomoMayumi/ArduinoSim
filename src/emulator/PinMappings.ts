import { CPU, portBConfig, portCConfig, portDConfig } from 'avr8js';

export type PinId = string; // "D0", "D13", "A0", etc.

export interface PinConfig {
    portConfig: any; // portBConfig etc.
    pinIndex: number; // 0-7
    portName: 'B' | 'C' | 'D';
}

export const ARDUINO_PINS: { [key: string]: PinConfig } = {
    // PORT D (Digital 0-7)
    'D0': { portConfig: portDConfig, pinIndex: 0, portName: 'D' },
    'D1': { portConfig: portDConfig, pinIndex: 1, portName: 'D' },
    'D2': { portConfig: portDConfig, pinIndex: 2, portName: 'D' },
    'D3': { portConfig: portDConfig, pinIndex: 3, portName: 'D' },
    'D4': { portConfig: portDConfig, pinIndex: 4, portName: 'D' },
    'D5': { portConfig: portDConfig, pinIndex: 5, portName: 'D' },
    'D6': { portConfig: portDConfig, pinIndex: 6, portName: 'D' },
    'D7': { portConfig: portDConfig, pinIndex: 7, portName: 'D' },

    // PORT B (Digital 8-13)
    'D8': { portConfig: portBConfig, pinIndex: 0, portName: 'B' },
    'D9': { portConfig: portBConfig, pinIndex: 1, portName: 'B' },
    'D10': { portConfig: portBConfig, pinIndex: 2, portName: 'B' },
    'D11': { portConfig: portBConfig, pinIndex: 3, portName: 'B' },
    'D12': { portConfig: portBConfig, pinIndex: 4, portName: 'B' },
    'D13': { portConfig: portBConfig, pinIndex: 5, portName: 'B' },

    // PORT C (Analog Inputs A0-A5)
    'A0': { portConfig: portCConfig, pinIndex: 0, portName: 'C' },
    'A1': { portConfig: portCConfig, pinIndex: 1, portName: 'C' },
    'A2': { portConfig: portCConfig, pinIndex: 2, portName: 'C' },
    'A3': { portConfig: portCConfig, pinIndex: 3, portName: 'C' },
    'A4': { portConfig: portCConfig, pinIndex: 4, portName: 'C' },
    'A5': { portConfig: portCConfig, pinIndex: 5, portName: 'C' },
};

export function getPinState(cpu: CPU, pin: string): boolean {
    const config = ARDUINO_PINS[pin];
    if (!config) return false;

    const portValue = cpu.data[config.portConfig.PORT];
    return (portValue & (1 << config.pinIndex)) !== 0;
}
