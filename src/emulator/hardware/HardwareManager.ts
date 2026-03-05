import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';

export class HardwareManager {
    private components: Component[] = [];
    private highFreqComponents: Component[] = [];
    private lowFreqComponents: Component[] = [];
    private cpu: CPU;
    private lastLowFreqUpdate: number = 0;
    private readonly DEFAULT_LOW_FREQ_INTERVAL = 512;

    constructor(cpu: CPU) {
        this.cpu = cpu;
    }

    public addComponent(component: Component) {
        this.components.push(component);
        this.refreshGroups();
    }

    public removeComponent(id: string) {
        this.components = this.components.filter(c => c.id !== id);
        this.refreshGroups();
    }

    private refreshGroups() {
        this.highFreqComponents = this.components.filter(c => c.updateInterval === 1);
        this.lowFreqComponents = this.components.filter(c => (c.updateInterval || 0) !== 1);
    }

    public getComponent(id: string): Component | undefined {
        return this.components.find(c => c.id === id);
    }

    public getAllComponents(): Component[] {
        return this.components;
    }

    public update() {
        // 高頻度コンポーネント (updateInterval === 1) は毎サイクル更新
        for (const component of this.highFreqComponents) {
            component.update(this.cpu);
        }

        // 低頻度コンポーネントは一定間隔ごとに更新
        const cycles = this.cpu.cycles;
        if (cycles - this.lastLowFreqUpdate >= this.DEFAULT_LOW_FREQ_INTERVAL) {
            for (const component of this.lowFreqComponents) {
                component.update(this.cpu);
            }
            this.lastLowFreqUpdate = cycles;
        }
    }

    // UI用の全コンポーネント状態スナップショットを取得
    public getAllStates(): { [id: string]: ComponentState } {
        const states: { [id: string]: ComponentState } = {};
        for (const component of this.components) {
            states[component.id] = component.getState();
        }
        return states;
    }
}
