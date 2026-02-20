export interface DisassembledInstruction {
    address: number;
    wordCount: number;
    hex: string;
    instruction: string;
}

export class Disassembler {
    public static disassemble(program: Uint16Array): DisassembledInstruction[] {
        const result: DisassembledInstruction[] = [];
        let pc = 0;

        while (pc < program.length) {
            const address = pc;
            const opcode = program[pc];
            let wordCount = 1;
            let instruction = "UNKNOWN";

            // Basic decoding heuristics based on AVR instruction set
            if (opcode === 0x0000) {
                instruction = "NOP";
            } else if ((opcode & 0xf000) === 0xc000) {
                let k = (opcode & 0x0fff);
                if (k & 0x0800) k -= 0x1000;
                instruction = `RJMP .+${k * 2}`;
            } else if ((opcode & 0xf000) === 0xd000) {
                let k = (opcode & 0x0fff);
                if (k & 0x0800) k -= 0x1000;
                instruction = `RCALL .+${k * 2}`;
            } else if ((opcode & 0xfe0e) === 0x940c) {
                wordCount = 2;
                if (pc + 1 < program.length) {
                    const k = ((opcode & 0x01f1) << 13) | program[pc + 1];
                    instruction = `JMP 0x${(k * 2).toString(16).toUpperCase()}`;
                }
            } else if ((opcode & 0xfe0e) === 0x940e) {
                wordCount = 2;
                if (pc + 1 < program.length) {
                    const k = ((opcode & 0x01f1) << 13) | program[pc + 1];
                    instruction = `CALL 0x${(k * 2).toString(16).toUpperCase()}`;
                }
            } else if (opcode === 0x9508) {
                instruction = "RET";
            } else if (opcode === 0x9518) {
                instruction = "RETI";
            } else if ((opcode & 0xff00) === 0x9a00) {
                const a = (opcode >> 3) & 0x1f;
                const b = opcode & 7;
                instruction = `SBI 0x${a.toString(16).toUpperCase()}, ${b}`;
            } else if ((opcode & 0xff00) === 0x9800) {
                const a = (opcode >> 3) & 0x1f;
                const b = opcode & 7;
                instruction = `CBI 0x${a.toString(16).toUpperCase()}, ${b}`;
            } else if ((opcode & 0xf000) === 0xe000) {
                const k = ((opcode >> 4) & 0xf0) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x0f) + 16;
                instruction = `LDI r${d}, 0x${k.toString(16).toUpperCase()}`;
            } else if ((opcode & 0xf800) === 0xb800) {
                const a = ((opcode >> 5) & 0x30) | (opcode & 0x0f);
                const r = ((opcode >> 4) & 0x1f);
                instruction = `OUT 0x${a.toString(16).toUpperCase()}, r${r}`;
            } else if ((opcode & 0xf800) === 0xb000) {
                const a = ((opcode >> 5) & 0x30) | (opcode & 0x0f);
                const r = ((opcode >> 4) & 0x1f);
                instruction = `IN r${r}, 0x${a.toString(16).toUpperCase()}`;
            } else if ((opcode & 0xfe0f) === 0x940a) {
                const d = ((opcode >> 4) & 0x1f);
                instruction = `DEC r${d}`;
            } else if ((opcode & 0xfe0f) === 0x9403) {
                const d = ((opcode >> 4) & 0x1f);
                instruction = `INC r${d}`;
            } else if ((opcode & 0xfc00) === 0x1000) {
                const r = ((opcode >> 5) & 0x10) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x1f);
                instruction = `CPSE r${d}, r${r}`;
            } else if ((opcode & 0xfc00) === 0x1400) {
                const r = ((opcode >> 5) & 0x10) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x1f);
                instruction = `CP r${d}, r${r}`;
            } else if ((opcode & 0xf000) === 0x3000) {
                const k = ((opcode >> 4) & 0xf0) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x0f) + 16;
                instruction = `CPI r${d}, 0x${k.toString(16).toUpperCase()}`;
            } else if ((opcode & 0xfc00) === 0xf400) {
                let k = ((opcode >> 3) & 0x7f);
                if (k & 0x40) k -= 0x80;
                const s = opcode & 7;
                instruction = `BRBC ${s}, .+${k * 2}`;
            } else if ((opcode & 0xfc00) === 0xf000) {
                let k = ((opcode >> 3) & 0x7f);
                if (k & 0x40) k -= 0x80;
                const s = opcode & 7;
                instruction = `BRBS ${s}, .+${k * 2}`;
            } else if ((opcode & 0xfc00) === 0x0c00) {
                const r = ((opcode >> 5) & 0x10) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x1f);
                instruction = `ADD r${d}, r${r}`;
            } else if ((opcode & 0xfc00) === 0x1c00) {
                const r = ((opcode >> 5) & 0x10) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x1f);
                instruction = `ADC r${d}, r${r}`;
            } else if ((opcode & 0xfc00) === 0x0800) {
                const r = ((opcode >> 5) & 0x10) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x1f);
                instruction = `SBC r${d}, r${r}`;
            } else if ((opcode & 0xfc00) === 0x2400) {
                const r = ((opcode >> 5) & 0x10) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x1f);
                instruction = `EOR r${d}, r${r}`;
            } else if ((opcode & 0xfc00) === 0x2c00) {
                const r = ((opcode >> 5) & 0x10) | (opcode & 0x0f);
                const d = ((opcode >> 4) & 0x1f);
                instruction = `MOV r${d}, r${r}`;
            } else if ((opcode & 0xfe0f) === 0x9000) {
                wordCount = 2;
                if (pc + 1 < program.length) {
                    const r = ((opcode >> 4) & 0x1f);
                    const k = program[pc + 1];
                    instruction = `LDS r${r}, 0x${k.toString(16).toUpperCase()}`;
                }
            } else if ((opcode & 0xfe0f) === 0x9200) {
                wordCount = 2;
                if (pc + 1 < program.length) {
                    const r = ((opcode >> 4) & 0x1f);
                    const k = program[pc + 1];
                    instruction = `STS 0x${k.toString(16).toUpperCase()}, r${r}`;
                }
            } else {
                instruction = `0x${opcode.toString(16).padStart(4, '0').toUpperCase()}`;
            }

            let hexStr = opcode.toString(16).padStart(4, '0').toUpperCase();
            if (wordCount === 2 && pc + 1 < program.length) {
                hexStr += ' ' + program[pc + 1].toString(16).padStart(4, '0').toUpperCase();
            }

            result.push({
                address: pc * 2,
                wordCount,
                hex: hexStr,
                instruction
            });

            pc += wordCount;
        }

        return result;
    }
}
