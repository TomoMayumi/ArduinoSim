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

    // AVR の場合、.note.gnu.avr.deviceinfo からMCU種別を検出する
    let avrMcuName: string | null = null;
    if (!isARM) {
      const noteSection = sections.get('.note.gnu.avr.deviceinfo');
      if (noteSection && noteSection.data.length >= 12) {
        avrMcuName = this.parseAvrDeviceNote(noteSection.data);
      }
    }

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

    return { programData, entryPoint, sections, architecture: isARM ? 'ARM' : this.resolveAvrArchitecture(avrMcuName) };
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

  /**
   * .note.gnu.avr.deviceinfo セクションからデバイス名を取得する。
   * Note 形式: namesz(4) + descsz(4) + type(4) + name("AVR\0") + descriptor
   * descriptor: core(4) + flash_start(4) + flash_size(4) + sram_start(4) +
   *             sram_size(4) + eeprom_start(4) + eeprom_size(4) + device_name(...)
   */
  private parseAvrDeviceNote(data: Uint8Array): string | null {
    try {
      const noteView = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const namesz = noteView.getUint32(0, true);
      const descsz = noteView.getUint32(4, true);
      const type = noteView.getUint32(8, true);

      // NT_GNU_ABI_TAG = 1, but AVR uses type 1 for device info
      if (type !== 1 || namesz !== 4) return null;

      // name should be "AVR\0"
      const name = this.readCString(data, 12);
      if (name !== 'AVR') return null;

      // descriptor starts after name (aligned to 4 bytes)
      const descOffset = 12 + Math.ceil(namesz / 4) * 4;
      if (data.length < descOffset + descsz) return null;

      // device name string follows the 7 uint32 fields (28 bytes)
      const deviceNameOffset = descOffset + 28;
      if (deviceNameOffset >= data.length) return null;

      return this.readCString(data, deviceNameOffset);
    } catch {
      return null;
    }
  }

  /**
   * AVR MCU 名からアーキテクチャ文字列を解決する。
   * 不明な場合は 'AVR'（ATmega328P 相当）をデフォルトとする。
   */
  private resolveAvrArchitecture(mcuName: string | null): string {
    if (!mcuName) return 'AVR';
    const lower = mcuName.toLowerCase();
    if (lower.includes('atmega168') || lower === 'atmega168pa' || lower === 'atmega168a' || lower === 'atmega168p') {
      return 'AVR_ATMEGA168PA';
    }
    return 'AVR';
  }
}
