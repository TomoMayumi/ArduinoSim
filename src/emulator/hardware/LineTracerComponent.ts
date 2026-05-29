import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { getPinState, setPinInput } from '../PinMappings';

export interface LineTracerState extends ComponentState {
    x: number;
    y: number;
    angle: number;
    leftSpeed: number;
    rightSpeed: number;
    sensors: boolean[];
    trackType: 'oval';
}

export const LINE_TRACER_CANVAS_W = 500;
export const LINE_TRACER_CANVAS_H = 350;

const TRACK_CX = 250;
const TRACK_CY = 175;
const TRACK_RX = 190;
const TRACK_RY = 125;
const TRACK_HALF_W = 18;
const RX_OUTER = TRACK_RX + TRACK_HALF_W; // 208
const RY_OUTER = TRACK_RY + TRACK_HALF_W; // 143
const RX_INNER = TRACK_RX - TRACK_HALF_W; // 172
const RY_INNER = TRACK_RY - TRACK_HALF_W; // 107

const MAX_SPEED = 80;           // px/s at 100% PWM duty cycle
const WHEEL_BASE = 36;          // px (distance between wheels)
const PHYSICS_INTERVAL = 16000; // CPU cycles per physics step (~1ms at 16MHz)
const PWM_PERIOD = 1600000;     // CPU cycles per PWM measurement window (~100ms)

// Sensor offsets in robot-local frame: X = robot-right, Y = robot-forward
const SENSOR_OFFSETS = [
    { lx: -20, ly: 22 }, // left sensor
    { lx:   0, ly: 22 }, // center sensor
    { lx:  20, ly: 22 }, // right sensor
] as const;

export interface LineTracerHWConfig {
    leftPwmPin: string;
    leftDirPin: string;
    leftDirActiveHigh: boolean;
    rightPwmPin: string;
    rightDirPin: string;
    rightDirActiveHigh: boolean;
    sensorPins: string[];     // [leftPin, centerPin, rightPin]
    sensorOnBlack: boolean;   // true = pin HIGH when sensor is on black
}

function isOnTrack(px: number, py: number): boolean {
    const dx = px - TRACK_CX;
    const dy = py - TRACK_CY;
    const outerVal = (dx / RX_OUTER) ** 2 + (dy / RY_OUTER) ** 2;
    const innerVal = (dx / RX_INNER) ** 2 + (dy / RY_INNER) ** 2;
    // Point is on track (black ring) if inside outer ellipse AND outside inner ellipse
    return outerVal <= 1.0 && innerVal >= 1.0;
}

export class LineTracerComponent implements Component {
    readonly type = 'LINE_TRACER';
    readonly id: string;
    readonly name: string;
    readonly updateInterval = 1; // Called every CPU cycle for accurate PWM measurement

    private hwConfig: LineTracerHWConfig;

    // Robot state
    private robotX: number;
    private robotY: number;
    private robotAngle = 0; // radians; 0 = facing right (+X in canvas)

    // Left motor PWM measurement
    private leftHighCycles = 0;
    private leftTotalCycles = 0;
    private leftSpeed = 0; // 0.0–1.0 duty cycle

    // Right motor PWM measurement
    private rightHighCycles = 0;
    private rightTotalCycles = 0;
    private rightSpeed = 0;

    private lastCycles = 0;
    private physicsCycles = 0;
    private sensors: boolean[] = [false, false, false];

    constructor(id: string, name: string, hwConfig: LineTracerHWConfig) {
        this.id = id;
        this.name = name;
        this.hwConfig = hwConfig;
        // Start at bottom-center of oval, facing right
        this.robotX = TRACK_CX;
        this.robotY = TRACK_CY + TRACK_RY;
    }

    update(cpu: CPU): void {
        const dt = cpu.cycles - this.lastCycles;
        if (dt <= 0) return;
        this.lastCycles = cpu.cycles;

        // Accumulate left PWM duty cycle
        if (getPinState(cpu, this.hwConfig.leftPwmPin)) this.leftHighCycles += dt;
        this.leftTotalCycles += dt;
        if (this.leftTotalCycles >= PWM_PERIOD) {
            this.leftSpeed = this.leftHighCycles / this.leftTotalCycles;
            this.leftHighCycles = 0;
            this.leftTotalCycles -= PWM_PERIOD;
        }

        // Accumulate right PWM duty cycle
        if (getPinState(cpu, this.hwConfig.rightPwmPin)) this.rightHighCycles += dt;
        this.rightTotalCycles += dt;
        if (this.rightTotalCycles >= PWM_PERIOD) {
            this.rightSpeed = this.rightHighCycles / this.rightTotalCycles;
            this.rightHighCycles = 0;
            this.rightTotalCycles -= PWM_PERIOD;
        }

        // Step physics at ~1ms intervals
        this.physicsCycles += dt;
        while (this.physicsCycles >= PHYSICS_INTERVAL) {
            this.physicsCycles -= PHYSICS_INTERVAL;
            this.stepPhysics(cpu, PHYSICS_INTERVAL / 16_000_000);
        }
    }

    private stepPhysics(cpu: CPU, dt: number): void {
        const leftFwd = getPinState(cpu, this.hwConfig.leftDirPin) === this.hwConfig.leftDirActiveHigh;
        const rightFwd = getPinState(cpu, this.hwConfig.rightDirPin) === this.hwConfig.rightDirActiveHigh;

        const vL = this.leftSpeed * MAX_SPEED * (leftFwd ? 1 : -1);
        const vR = this.rightSpeed * MAX_SPEED * (rightFwd ? 1 : -1);

        // Differential drive model
        const v = (vL + vR) / 2;
        const omega = (vR - vL) / WHEEL_BASE;

        this.robotAngle += omega * dt;
        // Normalize to [-π, π]
        if (this.robotAngle > Math.PI) this.robotAngle -= 2 * Math.PI;
        else if (this.robotAngle < -Math.PI) this.robotAngle += 2 * Math.PI;

        // Clamp to canvas bounds
        this.robotX = Math.max(20, Math.min(LINE_TRACER_CANVAS_W - 20,
            this.robotX + v * Math.cos(this.robotAngle) * dt));
        this.robotY = Math.max(20, Math.min(LINE_TRACER_CANVAS_H - 20,
            this.robotY + v * Math.sin(this.robotAngle) * dt));

        // Compute sensor canvas positions and check track
        const cosA = Math.cos(this.robotAngle);
        const sinA = Math.sin(this.robotAngle);
        this.sensors = SENSOR_OFFSETS.map(({ lx, ly }) => {
            // Transform from robot-local to canvas coordinates
            const sx = this.robotX + ly * cosA - lx * sinA;
            const sy = this.robotY + ly * sinA + lx * cosA;
            return isOnTrack(sx, sy);
        });

        // Drive sensor input pins so the program can read them
        for (let i = 0; i < Math.min(this.hwConfig.sensorPins.length, this.sensors.length); i++) {
            const pin = this.hwConfig.sensorPins[i];
            if (pin && pin !== 'None') {
                const onBlack = this.sensors[i];
                // sensorOnBlack=false (pull-up): LOW=black, HIGH=white
                setPinInput(cpu, pin, this.hwConfig.sensorOnBlack ? onBlack : !onBlack);
            }
        }
    }

    getState(): LineTracerState {
        return {
            x: this.robotX,
            y: this.robotY,
            angle: this.robotAngle,
            leftSpeed: this.leftSpeed,
            rightSpeed: this.rightSpeed,
            sensors: [...this.sensors],
            trackType: 'oval',
        };
    }
}
