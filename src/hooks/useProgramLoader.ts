import { useState, useEffect, useCallback } from 'react';
import { parseHex } from '../emulator/intelhex';
import { ElfParser } from '../emulator/ElfParser';
import { DwarfParser } from '../emulator/DwarfParser';
import type { DebugVariable } from '../emulator/DebugTypes';

// サンプル一覧の型定義
export interface SampleInfo {
  filename: string;
  name: string;
  category: string;
  description: string;
}

export function useProgramLoader(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [hexInput, setHexInput] = useState('');
  const [lssInput, setLssInput] = useState('');
  const [sourceFiles, setSourceFiles] = useState<{ name: string; content: string }[]>([]);
  const [program, setProgram] = useState<Uint16Array | null>(null);
  const [programSourceType, setProgramSourceType] = useState<'none' | 'hex' | 'elf'>('none');
  const [debugVariables, setDebugVariables] = useState<DebugVariable[]>([]);
  const [architecture, setArchitecture] = useState<string>('AVR');
  const [activeTabFilename, setActiveTabFilename] = useState<string | null>(null);

  // サンプル一覧
  const [sampleList, setSampleList] = useState<SampleInfo[]>([]);
  const [selectedSample, setSelectedSample] = useState('blink.json');

  // HEX / LSSデータの折りたたみ
  const [showHexLss, setShowHexLss] = useState(false);

  // HEXパース
  useEffect(() => {
    try {
      if (programSourceType === 'elf') return;
      if (hexInput) {
        setProgram(parseHex(hexInput));
        setArchitecture('AVR');
      } else {
        setProgram(null);
      }
    } catch (e) {
      console.error('HEX Parse Error:', e);
    }
  }, [hexInput, programSourceType]);

  // サンプル一覧を読み込む
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}samples/sample_index.json`)
      .then(res => res.json())
      .then(data => {
        setSampleList(data.samples || []);
      })
      .catch(e => console.error('サンプル一覧の読み込みに失敗:', e));
  }, []);

  // 初回ロード時に Blink を読み込む
  useEffect(() => {
    loadSample('blink.json');
  }, []);

  // サンプルのグループ化
  const samplesByCategory = sampleList.reduce<Record<string, SampleInfo[]>>((acc, sample) => {
    if (!acc[sample.category]) acc[sample.category] = [];
    acc[sample.category].push(sample);
    return acc;
  }, {});

  const loadSample = async (filename: string) => {
    const sampleInfo = sampleList.find(s => s.filename === filename);

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/${filename}`);
      const data = await response.json();

      setLssInput(data.lss || '');
      setSourceFiles(data.sourceFiles || []);

      if (data.sourceFiles && data.sourceFiles.length > 0) {
        setActiveTabFilename(data.sourceFiles[0].name);
      } else {
        setActiveTabFilename(null);
      }

      if (data.hardwareConfigs) {
        localStorage.setItem('arduino_sim_hardware_config', JSON.stringify(data.hardwareConfigs));
        window.dispatchEvent(new Event('hardwareConfigChanged'));
      }

      if (data.elf) {
        // ELF形式のロード
        try {
          const binaryString = atob(data.elf);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const elfBuffer = bytes.buffer;

          const elfParser = new ElfParser(elfBuffer);
          const rawResult = elfParser.parse();
          const elfProgram = ElfParser.toProgram(rawResult.programData, rawResult.architecture);

          setArchitecture(rawResult.architecture);
          setProgramSourceType('elf');
          setProgram(elfProgram as any);
          setHexInput(data.hex || '');

          try {
            const dwarfParser = new DwarfParser(rawResult);
            const vars = dwarfParser.extractVariables();
            setDebugVariables(vars);
          } catch (dwarfErr) {
            console.warn('DWARF解析エラー:', dwarfErr);
            setDebugVariables([]);
          }
        } catch (elfErr) {
          console.error('ELF解析エラー:', elfErr);
          showToast('ELF形式の解析に失敗しました。HEX形式へのフォールバックを試みます', 'error');
          setProgramSourceType('hex');
          setHexInput(data.hex || '');
          setDebugVariables([]);
          setArchitecture('AVR');
        }
      } else {
        // 従来のHEX形式
        setProgramSourceType('hex');
        setHexInput(data.hex || '');
        setDebugVariables([]);
        setArchitecture('AVR');
      }

      setSelectedSample(filename);
      const displayName = sampleInfo?.name || filename.replace('.json', '');
      showToast(`${displayName} をロードしました`);
    } catch (e) {
      console.error('Sample Load Error:', e);
      showToast('サンプルのロードに失敗しました', 'error');
    }
  };

  // 現在の状態をサンプルJSONとしてエクスポート
  const exportCurrentState = useCallback(() => {
    const hwConfig = localStorage.getItem('arduino_sim_hardware_config');
    const data: Record<string, unknown> = {
      hex: hexInput,
      lss: lssInput,
      sourceFiles: sourceFiles,
    };
    if (hwConfig) {
      data.hardwareConfigs = JSON.parse(hwConfig);
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSample || 'export'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('現在の状態をエクスポートしました');
  }, [hexInput, lssInput, sourceFiles, selectedSample, showToast]);

  // フォルダアップロード処理
  const handleFolderUpload = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    stopEmulator: () => void,
    resetEmulator: () => void
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newSourceFiles: { name: string; content: string }[] = [];
    const validSourceExtensions = ['.c', '.h', '.cpp', '.hpp', '.s', '.asm'];
    let detectedHex: string | null = null;
    let detectedLss: string | null = null;
    let detectedElf: ArrayBuffer | null = null;

    const decodeFile = async (file: File): Promise<string> => {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        return utf8Decoder.decode(uint8Array);
      } catch {
        const sjisDecoder = new TextDecoder('windows-31j');
        return sjisDecoder.decode(uint8Array);
      }
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = (file as any).webkitRelativePath || file.name;
      const parts = fileName.split('/');
      const relativeName = parts.length > 1 ? parts.slice(1).join('/') : fileName;
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (validSourceExtensions.includes(ext)) {
        const content = await decodeFile(file);
        newSourceFiles.push({ name: relativeName, content });
      } else if (ext === '.hex') {
        detectedHex = await decodeFile(file);
      } else if (ext === '.lss') {
        detectedLss = await decodeFile(file);
      } else if (ext === '.elf') {
        detectedElf = await file.arrayBuffer();
      }
    }

    if (newSourceFiles.length > 0 || detectedHex || detectedLss || detectedElf) {
      let msg = '';
      if (newSourceFiles.length > 0) msg += `${newSourceFiles.length} 個のソースファイル`;
      if (detectedElf) msg += (msg ? '、' : '') + 'ELFファイル';
      else if (detectedHex) msg += (msg ? '、' : '') + 'HEXファイル';
      if (detectedLss) msg += (msg ? '、' : '') + 'LSSファイル';
      msg += 'が見つかりました。\n\n「OK」を押すと現在のリストに追加・上書きします。\n「キャンセル」を押すとクリアして新しく読み込みます。';

      const isAppend = window.confirm(msg);

      if (isAppend) {
        setSourceFiles(prev => {
          const merged = [...prev];
          newSourceFiles.forEach(newFile => {
            const idx = merged.findIndex(f => f.name === newFile.name);
            if (idx >= 0) {
              merged[idx] = newFile;
            } else {
              merged.push(newFile);
            }
          });
          return merged;
        });
      } else {
        stopEmulator();
        setHexInput('');
        setLssInput('');
        setSourceFiles(newSourceFiles);
        setActiveTabFilename(null);
        setSelectedSample('');
        setProgram(null);
        setDebugVariables([]);
        resetEmulator();
      }

      if (detectedElf) {
        try {
          const elfParser = new ElfParser(detectedElf);
          const rawResult = elfParser.parse();
          const elfProgram = ElfParser.toProgram(rawResult.programData, rawResult.architecture);

          setArchitecture(rawResult.architecture);
          setProgramSourceType('elf');
          setProgram(elfProgram as any);
          if (detectedHex) {
            setHexInput(detectedHex);
          } else {
            setHexInput('');
          }

          try {
            const dwarfParser = new DwarfParser(rawResult);
            const vars = dwarfParser.extractVariables();
            setDebugVariables(vars);
            if (vars.length > 0) {
              msg += ` (${vars.length}個のデバッグ変数を検出)`;
            }
          } catch (dwarfErr) {
            console.warn('DWARF解析エラー（変数情報なしで続行）:', dwarfErr);
            setDebugVariables([]);
          }
        } catch (elfErr) {
          console.error('ELF解析エラー:', elfErr);
          showToast('ELFファイルの解析に失敗しました', 'error');
          if (detectedHex) {
            setProgramSourceType('hex');
            setHexInput(detectedHex);
            setArchitecture('AVR');
          }
        }
      } else if (detectedHex) {
        setProgramSourceType('hex');
        setHexInput(detectedHex);
        setDebugVariables([]);
        setArchitecture('AVR');
      }
      if (detectedLss) setLssInput(detectedLss);

      if (newSourceFiles.length > 0 && !activeTabFilename) {
        setActiveTabFilename(newSourceFiles[0].name);
      }

      showToast(`${msg.split('が見つかりました')[0]}を読み込みました`);
    } else {
      showToast('有効なファイル（.c, .h, .hex, .lss 等）が見つかりませんでした。', 'error');
    }

    e.target.value = '';
  }, [activeTabFilename, showToast]);

  const clearProgram = useCallback((stopEmulator: () => void, resetEmulator: () => void) => {
    stopEmulator();
    setProgramSourceType('none');
    setHexInput('');
    setLssInput('');
    setSourceFiles([]);
    setActiveTabFilename(null);
    setSelectedSample('');
    setProgram(null);
    setDebugVariables([]);
    resetEmulator();
    showToast('プログラムをクリアしました');
  }, [showToast]);

  const addSourceFile = useCallback(() => {
    const name = prompt('ファイル名を入力してください (例: main.c):');
    if (name) {
      if (sourceFiles.find(f => f.name === name)) {
        showToast('そのファイル名は既に存在します', 'error');
        return;
      }
      setSourceFiles(prev => [...prev, { name, content: '' }]);
      setActiveTabFilename(name);
    }
  }, [sourceFiles, showToast]);

  const removeSourceFile = useCallback((name: string) => {
    setSourceFiles(prev => prev.filter(f => f.name !== name));
    if (activeTabFilename === name) {
      setActiveTabFilename(null);
    }
  }, [activeTabFilename]);

  const updateSourceFileContent = useCallback((content: string) => {
    if (activeTabFilename) {
      setSourceFiles(prev => prev.map(f =>
        f.name === activeTabFilename ? { ...f, content } : f
      ));
    }
  }, [activeTabFilename]);

  return {
    // プログラム状態
    program,
    programSourceType,
    hexInput,
    setHexInput,
    setProgramSourceType,
    lssInput,
    sourceFiles,
    debugVariables,
    architecture,
    activeTabFilename,
    setActiveTabFilename,

    // サンプル
    sampleList,
    selectedSample,
    samplesByCategory,

    // HEX/LSSの折りたたみ
    showHexLss,
    setShowHexLss,

    // アクション
    loadSample,
    handleFolderUpload,
    exportCurrentState,
    clearProgram,
    addSourceFile,
    removeSourceFile,
    updateSourceFileContent,
  };
}
