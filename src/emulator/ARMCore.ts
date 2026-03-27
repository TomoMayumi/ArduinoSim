import type { RA4M1 } from './RA4M1';

/**
 * ARMv7-M (Cortex-M4) Instruction Set Interpreter
 * 主要な Thumb/Thumb-2 命令を実装し、RA4M1 (Arduino R4) の動作をサポートします。
 */
export class ARMCore {
    public regs = new Uint32Array(16);
    public pc = 0;
    public xpsr = 0;
    public cycles = 0;
    private mcu: RA4M1;

    constructor(mcu: RA4M1) {
        this.mcu = mcu;
    }

    public reset() {
        this.regs.fill(0);
        this.xpsr = 0x01000000; // Default T-bit set
        this.cycles = 0;
    }

    public step() {
        const instr = this.fetch16();
        
        // Thumb-2 (32-bit) 命令の判定
        if ((instr & 0xE000) === 0xE000 && (instr & 0x1800) !== 0) {
            const instr2 = this.fetch16();
            this.execute32((instr << 16) | instr2);
        } else {
            this.execute16(instr);
        }
        this.cycles++;
    }

    private fetch16(): number {
        const val = this.mcu.read8(this.pc) | (this.mcu.read8(this.pc + 1) << 8);
        this.pc += 2;
        return val;
    }

    private execute16(instr: number) {
        const op = instr >> 11;
        switch (op) {
            case 0x00: case 0x01: case 0x02: // LSLS, LSRS, ASRS
                this.executeShift(instr);
                break;
            case 0x03: // ADDS/SUBS (reg)
                this.executeAddSubReg(instr);
                break;
            case 0x04: case 0x05: case 0x06: case 0x07: // MOVS, CMP, ADDS, SUBS (imm)
                this.executeImm(instr);
                break;
            case 0x08: // Data processing
                this.executeDataProcessing(instr);
                break;
            case 0x09: // Special data / branch exchange
                this.executeSpecialData(instr);
                break;
            case 0x0A: case 0x0B: // LDR (PC-relative)
                this.executeLdrPc(instr);
                break;
            case 0x0C: case 0x0D: case 0x0E: case 0x0F: // LDR/STR (imm/reg)
                this.executeLdrStr(instr);
                break;
            case 0x10: case 0x11: // LDR/STRB (imm)
                this.executeLdrStrB(instr);
                break;
            case 0x12: case 0x13: // LDRH/STRH
                this.executeLdrStrH(instr);
                break;
            case 0x14: case 0x15: // LDR/STR (SP-relative)
                this.executeLdrStrSp(instr);
                break;
            case 0x16: case 0x17: // ADD/SUB (SP) / Misc
                this.executeMisc(instr);
                break;
            case 0x18: case 0x19: // LDM/STM
                this.executeLdmStm(instr);
                break;
            case 0x1A: case 0x1B: // Conditional branch / SVC
                this.executeCondBranch(instr);
                break;
            case 0x1C: // Unconditional branch
                this.executeBranch(instr);
                break;
        }
    }

    private execute32(instr: number) {
        // Thumb-2 instructions (LDR.W, STR.W, B.W, etc.)
        // RA4M1 の Arduino コアで頻出する命令を優先実装
        const op1 = (instr >> 26) & 0x3F;
        if (op1 === 0x1E) { // B.W / BL.W
            const s = (instr >> 26) & 1;
            const imm11 = instr & 0x7FF;
            const j1 = (instr >> 13) & 1;
            const j2 = (instr >> 11) & 1;
            const imm10 = (instr >> 16) & 0x3FF;
            const i1 = Number(!(j1 ^ s));
            const i2 = Number(!(j2 ^ s));
            const offset = ((s ? -1 : 0) << 24) | (i1 << 23) | (i2 << 22) | (imm10 << 12) | (imm11 << 1);
            if ((instr >> 14) & 1) { // BL
                this.regs[14] = this.pc | 1;
            }
            this.pc += offset - 4; // Adjust for fetch
        }
    }

    // 各命令の具体的実装 (フラグ更新含む)
    private executeImm(instr: number) {
        const op = (instr >> 11) & 0x3;
        const rd = (instr >> 8) & 0x7;
        const imm = instr & 0xFF;
        if (op === 0) { // MOVS
            this.regs[rd] = imm;
            this.updateFlagsNZ(imm);
        } else if (op === 2) { // ADDS
            const res = this.regs[rd] + imm;
            this.updateFlagsAdd(this.regs[rd], imm, res);
            this.regs[rd] = res;
        }
        // ... 他の命令 ...
    }

    private updateFlagsNZ(val: number) {
        this.xpsr &= ~0xF0000000;
        if (val === 0) this.xpsr |= 0x40000000; // Z
        if (val & 0x80000000) this.xpsr |= 0x80000000; // N
    }

    private updateFlagsAdd(_a: number, _b: number, res: number) {
        this.updateFlagsNZ(res);
        // Carry, Overflow (省略版)
    }

    private executeSpecialData(instr: number) {
        const op = (instr >> 7) & 0x3;
        if (op === 3) { // BX Rm
            const rm = (instr >> 3) & 0xF;
            this.pc = this.regs[rm] & ~1;
        }
    }

    private executeLdrPc(instr: number) {
        const rd = (instr >> 8) & 0x7;
        const imm = (instr & 0xFF) << 2;
        const addr = (this.pc & ~3) + 4 + imm;
        this.regs[rd] = this.mcu.read32(addr);
    }

    private executeLdrStr(instr: number) {
        const op = (instr >> 11) & 0x3;
        const rd = instr & 0x7;
        const rn = (instr >> 3) & 0x7;
        const imm = ((instr >> 6) & 0x1F) << 2;
        if (op === 1) { // LDR
            this.regs[rd] = this.mcu.read32(this.regs[rn] + imm);
        } else if (op === 0) { // STR
            this.mcu.write32(this.regs[rn] + imm, this.regs[rd]);
        }
    }

    private executeMisc(instr: number) {
        if ((instr & 0xFF00) === 0xB000) { // ADD/SUB SP
            const imm = (instr & 0x7F) << 2;
            if (instr & 0x0080) this.regs[13] -= imm;
            else this.regs[13] += imm;
        } else if ((instr & 0xF600) === 0xB400) { // PUSH
            const list = instr & 0xFF;
            const lr = (instr >> 8) & 1;
            if (lr) this.push(this.regs[14]);
            for (let i = 7; i >= 0; i--) {
                if (list & (1 << i)) this.push(this.regs[i]);
            }
        } else if ((instr & 0xF600) === 0xBC00) { // POP
            const list = instr & 0xFF;
            const pc = (instr >> 8) & 1;
            for (let i = 0; i < 8; i++) {
                if (list & (1 << i)) this.regs[i] = this.pop();
            }
            if (pc) this.pc = this.pop() & ~1;
        }
    }

    private push(val: number) {
        this.regs[13] -= 4;
        this.mcu.write32(this.regs[13], val);
    }

    private pop(): number {
        const val = this.mcu.read32(this.regs[13]);
        this.regs[13] += 4;
        return val;
    }

    private executeCondBranch(instr: number) {
        const cond = (instr >> 8) & 0xF;
        const imm = (instr & 0xFF) << 1;
        const offset = imm >= 0x100 ? imm - 0x200 : imm;
        if (this.checkCond(cond)) {
            this.pc += offset;
        }
    }

    private checkCond(cond: number): boolean {
        const n = !!(this.xpsr & 0x80000000);
        const z = !!(this.xpsr & 0x40000000);
        const c = !!(this.xpsr & 0x20000000);
        const v = !!(this.xpsr & 0x10000000);
        switch (cond) {
            case 0: return z; // EQ
            case 1: return !z; // NE
            case 2: return c; // CS
            case 3: return !c; // CC
            case 4: return n; // MI
            case 5: return !n; // PL
            case 6: return v; // VS
            case 7: return !v; // VC
            case 8: return c && !z; // HI
            case 9: return !c || z; // LS
            case 10: return n === v; // GE
            case 11: return n !== v; // LT
            case 12: return !z && n === v; // GT
            case 13: return z || n !== v; // LE
            default: return true; // AL
        }
    }

    private executeBranch(instr: number) {
        const offset = (instr & 0x7FF) << 1;
        const sign = offset >= 0x800 ? offset - 0x1000 : offset;
        this.pc += sign;
    }

    private executeShift(instr: number) {
        const op = (instr >> 11) & 0x3;
        const rd = instr & 0x7;
        const rm = (instr >> 3) & 0x7;
        const imm = (instr >> 6) & 0x1F;
        if (op === 0) { // LSLS
            this.regs[rd] = this.regs[rm] << imm;
        } else if (op === 1) { // LSRS
            this.regs[rd] = this.regs[rm] >>> imm;
        } else if (op === 2) { // ASRS
            this.regs[rd] = (this.regs[rm] | 0) >> imm;
        }
        this.updateFlagsNZ(this.regs[rd]);
    }

    private executeAddSubReg(instr: number) {
        const op = (instr >> 9) & 0x3;
        const rd = instr & 0x7;
        const rn = (instr >> 3) & 0x7;
        const rm = (instr >> 6) & 0x7;
        if (op === 0) { // ADDS
            this.regs[rd] = this.regs[rn] + this.regs[rm];
        } else if (op === 2) { // SUBS
            this.regs[rd] = this.regs[rn] - this.regs[rm];
        }
        this.updateFlagsNZ(this.regs[rd]);
    }

    private executeDataProcessing(instr: number) {
        const op = (instr >> 6) & 0xF;
        const rd = instr & 0x7;
        const rm = (instr >> 3) & 0x7;
        switch (op) {
            case 0: this.regs[rd] &= this.regs[rm]; break; // AND
            case 1: this.regs[rd] ^= this.regs[rm]; break; // EOR
            case 2: this.regs[rd] <<= (this.regs[rm] & 0xFF); break; // LSL
            case 3: this.regs[rd] >>>= (this.regs[rm] & 0xFF); break; // LSR
            case 12: this.regs[rd] |= this.regs[rm]; break; // ORR
            case 13: this.regs[rd] = this.regs[rd] * this.regs[rm]; break; // MUL
        }
        this.updateFlagsNZ(this.regs[rd]);
    }

    private executeLdrStrB(_instr: number) {
    }

    private executeLdrStrH(_instr: number) {
    }

    private executeLdrStrSp(_instr: number) {
    }

    private executeLdmStm(_instr: number) {
    }
}
