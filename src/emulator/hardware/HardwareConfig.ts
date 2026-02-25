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

/**
 * 固定コンポーネントのデフォルト設定。
 * この配列の順序が画面上の表示順序となる。
 * LED×4, スイッチ×4, 可変抵抗, モーター, 4桁7セグLED, LCD, ADキー回路
 */
export const DEFAULT_CONFIGS: HardwareConfig[] = [
    { id: 'led-1', type: 'LED', name: 'LED 1', pin: 'D13', color: '#ff0000' },
    { id: 'led-2', type: 'LED', name: 'LED 2', pin: 'D12', color: '#00ff00' },
    { id: 'led-3', type: 'LED', name: 'LED 3', pin: 'D11', color: '#0000ff' },
    { id: 'led-4', type: 'LED', name: 'LED 4', pin: 'D10', color: '#ffff00' },
    { id: 'sw-1', type: 'SWITCH', name: 'SW 1', pin: 'D2', mode: 'momentary' },
    { id: 'sw-2', type: 'SWITCH', name: 'SW 2', pin: 'D3', mode: 'momentary' },
    { id: 'sw-3', type: 'SWITCH', name: 'SW 3', pin: 'D4', mode: 'momentary' },
    { id: 'sw-4', type: 'SWITCH', name: 'SW 4', pin: 'D5', mode: 'toggle' },
    { id: 'pot-1', type: 'POTENTIOMETER', name: 'Potentiometer', pin: 'A0' },
    { id: 'motor-1', type: 'MOTOR', name: 'DC Motor', pin: 'D9' },
    { id: 'sevseg-1', type: 'SEVEN_SEGMENT', name: '4-Digit 7-Seg', pinA: 'D4', pinB: 'D5', pinC: 'D6', pinD: 'D7', pinD1: 'D8', pinD2: 'D9', pinD3: 'D10', pinD4: 'D11', pinDP: 'D3' },
    { id: 'lcd-1', type: 'LCD1602', name: 'LCD 1602', rs: 'D12', en: 'D11', d4: 'D5', d5: 'D4', d6: 'D3', d7: 'D2' },
    { id: 'adkey-1', type: 'AD_KEYBOARD', name: 'AD Keyboard', pin: 'A1' },
];

/**
 * 固定コンポーネントIDの順序リスト。
 * HardwarePanelはこの順序で描画し、設定変更時も順序が変わらない。
 */
export const FIXED_COMPONENT_IDS: string[] = DEFAULT_CONFIGS.map(c => c.id);

export function loadHardwareConfigs(): HardwareConfig[] {
    let stored: HardwareConfig[] = [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            stored = JSON.parse(raw);
        }
    } catch (e) {
        console.error('Failed to load hardware configs', e);
    }

    // 固定IDの順序を維持しながら、localStorageの設定をマージする。
    // loacalStorageに存在するIDはその設定を使い、存在しないIDはデフォルトを使う。
    return DEFAULT_CONFIGS.map(defaultCfg => {
        const saved = stored.find(c => c.id === defaultCfg.id);
        return saved ?? defaultCfg;
    });
}

export function saveHardwareConfigs(configs: HardwareConfig[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    } catch (e) {
        console.error('Failed to save hardware configs', e);
    }
}
