import type { BreakpointInfo } from './DebugTypes';
import type { Emulator } from './Emulator';
import { ARMCore } from './ARMCore';
import { HardwareManager } from './hardware/HardwareManager';

/**
 * RA4M1 (ARM Cortex-M4) エミュレーター
 */
export class RA4M1 implements Emulator {
    public cpu: ARMCore;
    public hardware: HardwareManager;
    public breakReason: string | null = null;
    public uart: UART;
    
    // メモリ領域
    private flash: Uint8Array;    // 0x00000000 - 0x0003FFFF (256KB)
    private sram: Uint8Array;     // 0x20000000 - 0x20007FFF (32KB)
    private peripherals: Uint8Array; // 0x40000000 - 0x40FFFFFF (16MB)

    constructor(program: Uint8Array) {
        this.flash = new Uint8Array(256 * 1024);
        this.flash.set(program);
        this.sram = new Uint8Array(32 * 1024);
        this.peripherals = new Uint8Array(1024 * 1024); // 1MB should be enough for basic use

        this.cpu = new ARMCore(this);
        this.hardware = new HardwareManager(this);
        this.uart = new UART();
        
        this.reset();
    }

    public get cycles() {
        return this.cpu.cycles;
    }

    public step(breakpoints: Map<number, BreakpointInfo>, evaluator?: any): number | null {
        for (let i = 0; i < 50000; i++) {
            const pc = this.cpu.pc;
            this.cpu.step();
            
            // AGT0 Timer decrement (Simplified)
            // AGT0 is 16-bit timer. 
            // 0x40084000 is AGT register
            const agt = this.read16(0x40084000);
            if (agt > 0) {
                this.write16(0x40084000, agt - 1);
            }

            if (breakpoints.has(pc)) {
                if (!evaluator) return pc;
                const result = evaluator.tryEvaluate('', this, pc);
                if (!result.error) return pc;
            }
        }
        return null;
    }

    public stepInstruction() {
        this.cpu.step();
    }

    public reset() {
        const view = new DataView(this.flash.buffer);
        this.cpu.reset();
        this.cpu.pc = view.getUint32(4, true); // Reset Vector
        this.cpu.regs[13] = view.getUint32(0, true); // Initial SP
        
        // 周辺レジスタ初期値
        this.write32(0x40084000, 0xFFFF); // AGT0
    }

    public stop() {
    }

    // メモリアクセス
    public read8(addr: number): number {
        if (addr < 0x00040000) return this.flash[addr];
        if (addr >= 0x20000000 && addr < 0x20008000) return this.sram[addr - 0x20000000];
        if (addr >= 0x40000000 && addr < 0x40100000) return this.peripherals[addr - 0x40000000];
        return 0;
    }

    public read16(addr: number): number {
        if (addr < 0x00040000) return new DataView(this.flash.buffer).getUint16(addr, true);
        if (addr >= 0x20000000 && addr < 0x20008000) return new DataView(this.sram.buffer).getUint16(addr - 0x20000000, true);
        return new DataView(this.peripherals.buffer).getUint16(addr - 0x40000000, true);
    }

    public read32(addr: number): number {
        if (addr < 0x00040000) return new DataView(this.flash.buffer).getUint32(addr, true);
        if (addr >= 0x20000000 && addr < 0x20008000) return new DataView(this.sram.buffer).getUint32(addr - 0x20000000, true);
        if (addr >= 0x40000000 && addr < 0x40100000) return new DataView(this.peripherals.buffer).getUint32(addr - 0x40000000, true);
        return 0;
    }

    public write8(addr: number, val: number) {
        if (addr >= 0x20000000 && addr < 0x20008000) this.sram[addr - 0x20000000] = val;
        else if (addr >= 0x40000000) this.handlePeripheralWrite(addr, val, 1);
    }

    public write16(addr: number, val: number) {
        if (addr >= 0x20000000 && addr < 0x20008000) new DataView(this.sram.buffer).setUint16(addr - 0x20000000, val, true);
        else if (addr >= 0x40000000) this.handlePeripheralWrite(addr, val, 2);
    }

    public write32(addr: number, val: number) {
        if (addr >= 0x20000000 && addr < 0x20008000) new DataView(this.sram.buffer).setUint32(addr - 0x20000000, val, true);
        else if (addr >= 0x40000000) this.handlePeripheralWrite(addr, val, 4);
    }

    private handlePeripheralWrite(addr: number, val: number, size: number) {
        const offset = addr - 0x40000000;
        if (offset < 0 || offset >= this.peripherals.length) return;
        
        if (size === 4) new DataView(this.peripherals.buffer).setUint32(offset, val, true);
        else if (size === 2) new DataView(this.peripherals.buffer).setUint16(offset, val, true);
        else this.peripherals[offset] = val;

        // RA4M1 Port 1 Pin 11 (D13 LED)
        // PORT1.PODR = 0x4004002C
        if (addr === 0x4004002C) {
            const isHigh = (val & (1 << 11)) !== 0;
            // D13 につながっているコンポーネントの状態を更新
            this.hardware.setPinState('D13', isHigh);
        }
    }
}


class UART {
    public onData: (data: string) => void = () => {};
    public write(data: number) {
        this.onData(String.fromCharCode(data));
    }
}
