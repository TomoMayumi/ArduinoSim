import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';

export class HardwareManager {
    private components: Component[] = [];
    private cpu: CPU;

    constructor(cpu: CPU) {
        this.cpu = cpu;
    }

    public addComponent(component: Component) {
        this.components.push(component);
    }

    public removeComponent(id: string) {
        this.components = this.components.filter(c => c.id !== id);
    }

    public getComponent(id: string): Component | undefined {
        return this.components.find(c => c.id === id);
    }

    public getAllComponents(): Component[] {
        return this.components;
    }

    public update() {
        for (const component of this.components) {
            component.update(this.cpu);
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
