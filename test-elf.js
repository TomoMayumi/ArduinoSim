import { readFileSync } from 'fs';

// ELF parser simplified logic
const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]; // \x7fELF
const SHT_PROGBITS = 1;
const SHF_ALLOC = 0x2;
const SHF_EXECINSTR = 0x4;

function parseElf(buffer) {
  const view = new DataView(buffer);
  const data = new Uint8Array(buffer);

  const shoff = view.getUint32(0x20, true);
  const shentsize = view.getUint16(0x2e, true);
  const shnum = view.getUint16(0x30, true);
  const shstrndx = view.getUint16(0x32, true);

  const shstrOff = view.getUint32(shoff + shstrndx * shentsize + 0x10, true);
  const shstrSize = view.getUint32(shoff + shstrndx * shentsize + 0x14, true);
  const shstrData = data.slice(shstrOff, shstrOff + shstrSize);

  function readCString(data, offset) {
    let end = offset;
    while (end < data.length && data[end] !== 0) end++;
    return new TextDecoder('utf-8').decode(data.slice(offset, end));
  }

  const sections = new Map();
  for (let i = 0; i < shnum; i++) {
    const base = shoff + i * shentsize;
    const nameIdx = view.getUint32(base + 0x00, true);
    const type = view.getUint32(base + 0x04, true);
    const flags = view.getUint32(base + 0x08, true);
    const addr = view.getUint32(base + 0x0c, true);
    const offset = view.getUint32(base + 0x10, true);
    const size = view.getUint32(base + 0x14, true);

    const name = readCString(shstrData, nameIdx);
    sections.set(name, { name, type, flags, addr, offset, size, dataLength: size });
  }

  const phoff = view.getUint32(0x1c, true);
  const phentsize = view.getUint16(0x2a, true);
  const phnum = view.getUint16(0x2c, true);

  const phdrs = [];
  let maxAddr = 0;
  const loadSegments = [];
  const PT_LOAD = 1;

  for (let i = 0; i < phnum; i++) {
    const base = phoff + i * phentsize;
    const type = view.getUint32(base + 0x00, true);
    const offset = view.getUint32(base + 0x04, true);
    const vaddr = view.getUint32(base + 0x08, true);
    const paddr = view.getUint32(base + 0x0c, true);
    const filesz = view.getUint32(base + 0x10, true);
    const memsz = view.getUint32(base + 0x14, true);
    const flags = view.getUint32(base + 0x18, true);
    phdrs.push({ type, offset, vaddr, paddr, filesz, memsz, flags });

    if (type === PT_LOAD && filesz > 0 && paddr < 0x800000) {
      const segmentData = data.slice(offset, offset + filesz);
      loadSegments.push({ paddr, data: segmentData });
      if (paddr + filesz > maxAddr) {
        maxAddr = paddr + filesz;
      }
    }
  }

  // AVRの標準的なプログラムサイズ(64KB)でフラッシュメモリを構成
  const programSize = Math.max(maxAddr, 65536);
  let programData = new Uint8Array(programSize);
  for (const seg of loadSegments) {
      programData.set(seg.data, seg.paddr);
  }

  const wordCount = Math.ceil(programData.length / 2);
  const program = new Uint16Array(wordCount);
  for (let i = 0; i < programData.length; i += 2) {
    const low = programData[i] || 0;
    const high = (i + 1 < programData.length) ? programData[i + 1] : 0;
    program[i / 2] = (high << 8) | low;
  }

  return {
      phdrs,
      sections: Array.from(sections.values()).map(s => ({name: s.name, addr: s.addr, size: s.size, offset: s.offset, type: s.type, flags: s.flags})),
      firstWords: Array.from(program.subarray(0, 16)).map(x => x.toString(16).padStart(4, '0')).join(' ')
  };
}

try {
    const file = readFileSync('c:/work/ArduinoSim/sample/hybrid/HybridSystem/Debug/HybridSystem.elf');
    console.log(JSON.stringify(parseElf(file.buffer), null, 2));
} catch(e) {
    console.error(e);
}
