/**
 * ELF32 Little-Endian パーサ
 * AVR (ATmega328P) 向けにELFファイルからプログラムデータとDWARFセクションを抽出する。
 */

/** ELFセクション情報 */
interface ElfSection {
  name: string;
  type: number;
  flags: number;
  addr: number;
  offset: number;
  size: number;
  data: Uint8Array;
}

/** ELFパース中間結果（内部用） */
export interface ElfRawResult {
  /** .textセクションのプログラムデータ */
  programData: Uint8Array;
  /** プログラムの開始アドレス */
  entryPoint: number;
  /** 全セクション */
  sections: Map<string, ElfSection>;
  /** アーキテクチャ (AVR/ARM) */
  architecture: string;
}

// ELF定数
const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]; // \x7fELF
const ELFCLASS32 = 1;
const ELFDATA2LSB = 1; // Little Endian

export class ElfParser {
  private view: DataView;
  private data: Uint8Array;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.data = new Uint8Array(buffer);
  }

  /** ELFファイルをパースする */
  public parse(): ElfRawResult {
    this.validateHeader();

    const entryPoint = this.view.getUint32(0x18, true);
    const shoff = this.view.getUint32(0x20, true);     // セクションヘッダテーブルのオフセット
    const shentsize = this.view.getUint16(0x2e, true);  // セクションヘッダエントリのサイズ
    const shnum = this.view.getUint16(0x30, true);      // セクションヘッダ数
    const shstrndx = this.view.getUint16(0x32, true);   // セクション名文字列テーブルのインデックス

    // セクション名文字列テーブルを読む
    const shstrOff = this.view.getUint32(shoff + shstrndx * shentsize + 0x10, true);
    const shstrSize = this.view.getUint32(shoff + shstrndx * shentsize + 0x14, true);
    const shstrData = this.data.slice(shstrOff, shstrOff + shstrSize);

    // セクションを解析
    const sections = new Map<string, ElfSection>();
    for (let i = 0; i < shnum; i++) {
      const base = shoff + i * shentsize;
      const nameIdx = this.view.getUint32(base + 0x00, true);
      const type = this.view.getUint32(base + 0x04, true);
      const flags = this.view.getUint32(base + 0x08, true);
      const addr = this.view.getUint32(base + 0x0c, true);
      const offset = this.view.getUint32(base + 0x10, true);
      const size = this.view.getUint32(base + 0x14, true);

      const name = this.readCString(shstrData, nameIdx);
      const sectionData = this.data.slice(offset, offset + size);

      sections.set(name, { name, type, flags, addr, offset, size, data: sectionData });
    }

    // E_MACHINE をチェック (AVR=83, ARM=40)
    const e_machine = this.view.getUint16(0x12, true);
    const isARM = e_machine === 40;

    const phoff = this.view.getUint32(0x1c, true);
    const phentsize = this.view.getUint16(0x2a, true);
    const phnum = this.view.getUint16(0x2c, true);

    const PT_LOAD = 1;
    let maxAddr = 0;
    const loadSegments: { paddr: number, data: Uint8Array }[] = [];

    // Program Headers からロードすべきセグメント（.text, .data等）を抽出
    for (let i = 0; i < phnum; i++) {
        const base = phoff + i * phentsize;
        const type = this.view.getUint32(base + 0x00, true);
        const offset = this.view.getUint32(base + 0x04, true);
        const paddr = this.view.getUint32(base + 0x0c, true);
        const filesz = this.view.getUint32(base + 0x10, true);

        // AVR: 0x800000 以上は RAM なので除外。ARM: すべての PT_LOAD を対象。
        if (type === PT_LOAD && filesz > 0) {
            if (!isARM && paddr >= 0x800000) continue;
            
            const segmentData = this.data.slice(offset, offset + filesz);
            loadSegments.push({ paddr, data: segmentData });
            if (paddr + filesz > maxAddr) {
                maxAddr = paddr + filesz;
            }
        }
    }

    // AVR: 標準 64KB, ARM: RA4M1 は 256KB
    const programSize = isARM ? 256 * 1024 : Math.max(maxAddr, 65536);
    let programData: Uint8Array = new Uint8Array(programSize);
    for (const seg of loadSegments) {
        // セグメントを適切なアドレスに配置
        // ARMの場合、Flashは 0x00000000 から始まる
        if (seg.paddr < programSize) {
            programData.set(seg.data, seg.paddr);
        }
    }

    return { programData, entryPoint, sections, architecture: isARM ? 'ARM' : 'AVR' };
  }

  /** ELFプログラムデータをUint16Array（avr8jsフォーマット）に変換 */
  public static toProgram(rawData: Uint8Array, arch: string = 'AVR'): Uint16Array | Uint8Array {
    if (arch === 'ARM') return rawData; // ARM はバイト配列のまま扱う

    const wordCount = Math.ceil(rawData.length / 2);
    const program = new Uint16Array(wordCount);
    for (let i = 0; i < rawData.length; i += 2) {
      const low = rawData[i] || 0;
      const high = (i + 1 < rawData.length) ? rawData[i + 1] : 0;
      program[i / 2] = (high << 8) | low;
    }
    return program;
  }

  /** ELFヘッダを検証 */
  private validateHeader(): void {
    if (this.data.length < 52) {
      throw new Error('ELFファイルが短すぎます');
    }

    // マジックナンバー
    for (let i = 0; i < 4; i++) {
      if (this.data[i] !== ELF_MAGIC[i]) {
        throw new Error('ELFマジックナンバーが一致しません');
      }
    }

    // 32bit
    if (this.data[4] !== ELFCLASS32) {
      throw new Error('32bit ELFのみサポートしています');
    }

    // Little Endian
    if (this.data[5] !== ELFDATA2LSB) {
      throw new Error('Little Endian ELFのみサポートしています');
    }
  }

  /** Null終端文字列を読む */
  private readCString(data: Uint8Array, offset: number): string {
    let end = offset;
    while (end < data.length && data[end] !== 0) end++;
    return new TextDecoder('utf-8').decode(data.slice(offset, end));
  }
}
