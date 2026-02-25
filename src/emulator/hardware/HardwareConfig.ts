export type ComponentType = 'LED' | 'SWITCH' | 'POTENTIOMETER' | 'SEVEN_SEGMENT' | 'MOTOR' | 'LCD1602' | 'AD_KEYBOARD';

export interface BaseConfig {
    id: string;
    type: ComponentType;
    name: string;
}

export interface LedConfig extends BaseConfig {
    type: 'LED';
    pin: string;
    color: string;
}

export interface SwitchConfig extends BaseConfig {
    type: 'SWITCH';
    pin: string;
    mode: 'momentary' | 'toggle';
}

export interface PotentiometerConfig extends BaseConfig {
    type: 'POTENTIOMETER';
    pin: string;
}

export interface MotorConfig extends BaseConfig {
    type: 'MOTOR';
    pin: string;
}

export interface SevenSegmentConfig extends BaseConfig {
    type: 'SEVEN_SEGMENT';
    pinA: string;
    pinB: string;
    pinC: string;
    pinD: string;
    pinD1: string;
    pinD2: string;
    pinD3: string;
    pinD4: string;
    pinDP: string;
}

export interface Lcd1602Config extends BaseConfig {
    type: 'LCD1602';
    rs: string;
    en: string;
    d4: string;
    d5: string;
    d6: string;
    d7: string;
}

export interface AdKeyboardConfig extends BaseConfig {
    type: 'AD_KEYBOARD';
    pin: string;
}

export type HardwareConfig = LedConfig | SwitchConfig | PotentiometerConfig | SevenSegmentConfig | MotorConfig | Lcd1602Config | AdKeyboardConfig;

const STORAGE_KEY = 'arduino_sim_hardware_config';

const DEFAULT_CONFIGS: HardwareConfig[] = [
    { id: 'led-d12', type: 'LED', name: 'Blue LED', pin: 'D12', color: '#0000ff' },
    { id: 'sw-d2', type: 'SWITCH', name: 'Button', pin: 'D2', mode: 'momentary' },
    { id: 'sw-d3', type: 'SWITCH', name: 'Toggle Switch', pin: 'D3', mode: 'toggle' },
    { id: 'pot-a0', type: 'POTENTIOMETER', name: 'Potentiometer', pin: 'A0' },
    { id: 'sevseg-1', type: 'SEVEN_SEGMENT', name: '4-Digit 7-Segment', pinA: 'D4', pinB: 'D5', pinC: 'D6', pinD: 'D7', pinD1: 'D8', pinD2: 'D9', pinD3: 'D10', pinD4: 'D11', pinDP: 'D3' },
    { id: 'motor-1', type: 'MOTOR', name: 'DC Motor', pin: 'D9' },
    { id: 'lcd-1', type: 'LCD1602', name: 'LCD 1602', rs: 'D12', en: 'D11', d4: 'D5', d5: 'D4', d6: 'D3', d7: 'D2' },
    { id: 'adkey-a1', type: 'AD_KEYBOARD', name: 'AD Keyboard', pin: 'A1' }
];

export function loadHardwareConfigs(): HardwareConfig[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load hardware configs", e);
    }
    return DEFAULT_CONFIGS;
}

export function saveHardwareConfigs(configs: HardwareConfig[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    } catch (e) {
        console.error("Failed to save hardware configs", e);
    }
}
