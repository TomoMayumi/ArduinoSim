import type { Component } from './Component';
import type { HardwareConfig } from './HardwareConfig';
import { LedComponent } from './LedComponent';
import { SwitchComponent } from './SwitchComponent';
import { PotentiometerComponent } from './PotentiometerComponent';
import { SevenSegmentComponent } from './SevenSegmentComponent';
import { MotorComponent } from './MotorComponent';
import { Lcd1602Component } from './Lcd1602Component';

export function createComponentFromConfig(config: HardwareConfig): Component | null {
    switch (config.type) {
        case 'LED':
            return new LedComponent(config.id, config.name, config.pin, config.color);
        case 'SWITCH':
            return new SwitchComponent(config.id, config.name, config.pin, config.mode);
        case 'POTENTIOMETER':
            // Start potentiometers at 0V
            return new PotentiometerComponent(config.id, config.name, config.pin, 0);
        case 'SEVEN_SEGMENT':
            // Notice: SevenSegment internally hardcodes pins right now
            return new SevenSegmentComponent(config.id, config.name);
        case 'MOTOR':
            return new MotorComponent(config.id, config.name, config.pin);
        case 'LCD1602':
            return new Lcd1602Component(
                config.id, config.name,
                config.rs, config.en,
                config.d4, config.d5, config.d6, config.d7
            );
        default:
            console.warn(`Unknown component type in config: ${(config as any).type}`);
            return null;
    }
}
