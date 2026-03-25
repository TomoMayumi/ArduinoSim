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
}

// ELF定数
const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]; // \x7fELF
const ELFCLASS32 = 1;
const ELFDATA2LSB = 1; // Little Endian
const SHT_PROGBITS = 1;
const SHF_ALLOC = 0x2;
const SHF_EXECINSTR = 0x4;

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

    // .textセクション（実行可能コード）を取得
    let programData: Uint8Array = new Uint8Array(0);
    const textSection = sections.get('.text');
    if (textSection) {
      programData = textSection.data;
    } else {
      // .textが無い場合、ALLOC+EXECINSTR フラグを持つセクションを結合
      const execSections = Array.from(sections.values())
        .filter(s => s.type === SHT_PROGBITS && (s.flags & SHF_ALLOC) && (s.flags & SHF_EXECINSTR))
        .sort((a, b) => a.addr - b.addr);

      if (execSections.length > 0) {
        const maxAddr = Math.max(...execSections.map(s => s.addr + s.size));
        programData = new Uint8Array(maxAddr);
        for (const s of execSections) {
          programData.set(s.data, s.addr);
        }
      }
    }

    return { programData, entryPoint, sections };
  }

  /** ELFプログラムデータをUint16Array（avr8jsフォーマット）に変換 */
  public static toProgram(rawData: Uint8Array): Uint16Array {
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
