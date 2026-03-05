import { useState, useEffect } from 'react';
import { parseHex } from './emulator/intelhex';
import { useEmulator } from './emulator/useEmulator';
import { Pin13Led } from './components/Pin13Led';
import { SerialConsole } from './components/SerialConsole';
import { HardwarePanel } from './components/HardwarePanel';
import { DisassemblyPanel } from './components/DisassemblyPanel';
import { SourceViewer } from './components/SourceViewer';
import { CpuStatePanel } from './components/CpuStatePanel';
import './index.css';

const BLINK_HEX = `
:1000000001C00000259A2D9A29E23FEF4FEF4A9553
:10001000F1F73A95D9F72A95C1F72D9829E23FEFE4
:100020004FEF4A95F1F73A95D9F72A95C1F7EBCFFB
:00000001FF
`.trim();

const SERIAL_ECHO_HEX = `
:1000000007E60093C40000E00093C50008E10093F8
:10001000C10006E00093C2001091C00017FFFCCFA2
:100020000091C6001091C00015FFFCCF0093C600E0
:02003000F3CF0C
:00000001FF
`.trim();

const BLINK2_HEX = `
:1000000001C00000249A2C9A29E23FEF4FEF4A9555
:10001000F1F73A95D9F72A95C1F72C9829E23FEFE5
:100020004FEF4A95F1F73A95D9F72A95C1F7EBCFFB
:00000001FF
`.trim();

const PUSH_SWITCH_HEX = `
:1000000001C00000259A52985A9A4A9902C02D9A26
:06001000FCCF2D98FACF91
:00000001FF
`.trim();

const POT_BLINK_HEX = `
:1000000001C00000259A389880E680937C0087E83C
:1000100080937A0081E080937E0087EC80937A0061
:1000200040E44A95F1F7209179002D9A0BD087ECA6
:1000300080937A0040E44A95F1F7209179002D9859
:1000400001D0EBCF3FEF4FEF4A95F1F73A95D9F753
:060050002A95C1F7089596
:00000001FF
`.trim();

const SEVEN_SEGMENT_HEX = `
:1000000001C00000209A219A229A239A539A549A66
:10001000559A569A579A289A299A2A9A2B9A5B980F
:1000200000E110912B001F70106110932B00289A93
:10003000299A2A9A2B9A28982CD0289A00E2109173
:100040002B001F70106210932B00289A299A2A9A6D
:100050002B9A29981ED0299A00E310912B001F702B
:10006000106310932B00289A299A2A9A2B9A2A987F
:1000700010D02A9A00E410912B001F701064109386
:100080002B00289A299A2A9A2B9A2B9802D02B9ADD
:10009000C7CF39E14AEF4A95F1F73A95D9F7089574
:00000001FF
`.trim();

const SEVEN_SEGMENT_COUNTUP_HEX = `
:1000000001C00000209A219A229A239A539A549A66
:10001000559A569A579A289A299A2A9A2B9A5B980F
:1000200050E060E070E080E090E0ADE7CAEF062FBE
:100030000295007F10912B001F70102B10932B0046
:10004000289A299A2A9A2B9A28985B98503019F066
:1000500057D0289A5B9A072F0295007F10912B00AA
:100060001F70102B10932B00289A299A2A9A2B9AEA
:1000700029985B98503019F043D0299A5B9A082F41
:100080000295007F10912B001F70102B10932B00F6
:10009000289A299A2A9A2B9A2A985B98503019F014
:1000A0002FD02A9A5B9A092F0295007F10912B007E
:1000B0001F70102B10932B00289A299A2A9A2B9A9A
:1000C0002B985B98503019F01BD02B9A5B9AA1505B
:1000D00019F401E05027ADE7C15081F46F5F6A3039
:1000E00001F460E07F5F7A3001F470E08F5F8A3066
:1000F00001F480E09F5F9A3009F490E0CAEF97CF57
:0E01000039E14AEF4A95F1F73A95D9F708959B
:00000001FF
`.trim();

const MOTOR_PWM_HEX = `
:1000000001C00000259A489A21982D9A20918000A3
:10001000213009F42DEC16C02F5F209380002091D5
:1000200080002093800088ED93E0A0E0B0E0DFCF93
:1000300088ED93E0A0E0B0E0DFCF2D9820918000A0
:10004000213009F42DEC0BC02F5F209380002091D8
:1000500080002093800088ED93E0A0E0B0E0DFCF8B
:10006000E7CF3FEF4FEF4A95F1F73A95D9F70895E2
:00000001FF
`.trim();

const LCD_HELLO_HEX = `
:1000000001C00000249A2B9A229A239A249A259A03
:100010002C9A22982398249825982B982C9838E251
:100020003BD038E039D038E037D032E035D032E273
:1000300033D03CE031D031E02FD036D048E44AD0DD
:1000400045E648D04CE646D04CE644D04FE642D0EA
:1000500020E040D057E73ED06FE63CD072E73AD04A
:100060006CE638D064E636D021E234D0FBCF1A88FD
:10007000198888ED93E0A0E0B0E0A12CB12CA10C4E
:10008000B10C81509040A040B04011F4EBCF08956F
:100090001000E5CF1A88198808CF00E00093000104
:1000A00008950895319830FD07C0219820FD03C0D6
:1000B000229801C0229A239822FD01C0239A2498CE
:1000C00024FD01C0249A259826FD01C0259A30E0EF
:1000D00039D0219A0895319A30FD07C0219820FDD5
:1000E00003C0229801C0229A239822FD01C0239ABD
:1000F000249824FD01C0249A259826FD01C0259ADA
:1001000030E039D0219A08952C9A08952C9808959C
:100110003BE036D02B982A9803D02B9A2A9811C083
:1001200033FB12C02B982AFD0DC02B9A0BC032FBBC
:100130000AC0229A18C0229816C031FB14C0239AE6
:1001400012C0239810C030FB0EC0249A0CC02498A9
:100150000AC037FB08C0259A06C0259804C036FBC9
:1001600002C0269A08952698089539E33BD033E03E
:0801700039D018D008951ED033
:00000001FF
`.trim();

const ANALOG_A0_TO_7SEG_HEX = `
:100000000FC000C000C000C000C000C000C000C0E1
:1000100000C000C000C000C000C000C04EC000C092
:1000200008E000935E000FEF00935D00209A219A94
:10003000229A239A539A549A559A569A579A289ADA
:10004000299A2A9A2B9A5B9800E600937C0007EC89
:1000500000937A0001E000937E0002E000934400E8
:1000600003E00093450009EF0093470002E000938E
:100070006E0060E070E080E090E0B0E07894009185
:100080007A000071E1F30091790017ED10937A0086
:1000900090E0202F285C18F082E0022F07C0202F6C
:1000A000245618F081E0022F01C080E070E00A5071
:1000B00010F07395FCCF602F00C00F931F93BF9378
:1000C000B395B43009F4B0E0289A299A2A9A2B9A69
:1000D0005B98B03059F4062F0295007F10912B00E9
:1000E0001F70102B10932B00289828C0B13059F4A2
:1000F000072F0295007F10912B001F70102B10937B
:100100002B0029981BC0B23059F4082F0295007FAC
:1001100010912B001F70102B10932B002A9800C0F9
:10012000092F0295007F10912B001F70102B109348
:0C0130002B002B98BF911F910F91189588
:00000001FF
`.trim();

const C_SAMPLE_HEX = `
:100000000C9434000C943E000C943E000C943E0082
:100010000C943E000C943E000C943E000C943E0068
:100020000C943E000C943E000C943E000C943E0058
:100030000C943E000C943E000C943E000C943E0048
:100040000C943E000C943E000C943E000C943E0038
:100050000C943E000C943E000C943E000C943E0028
:100060000C943E000C943E0011241FBECFEFD8E04C
:10007000DEBFCDBF0E9440000C9457000C940000DE
:100080008FEF8AB91BB882E084BD89EF87BD16BCAB
:1000900083E085BD22E031E089EE93E0A99BFECFAD
:1000A00025BB0197D9F78BB183278BB9F5CFF8948E
:0200B000FFCF80
:00000001FF
`.trim();

const C_SAMPLE_LSS = `
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug\\GccApplication.elf:     file format elf32-avr

Sections:
Idx Name          Size      VMA       LMA       File off  Algn
  0 .data         00000000  00800100  00800100  00000106  2**0
                  CONTENTS, ALLOC, LOAD, DATA
  1 .text         000000b2  00000000  00000000  00000054  2**1
                  CONTENTS, ALLOC, LOAD, READONLY, CODE

Disassembly of section .text:

00000000 <__vectors>:
__vectors():
  0:	0c 94 34 00 	jmp	0x68	; 0x68 <__ctors_end>
  4:	0c 94 3e 00 	jmp	0x7c	; 0x7c <__bad_interrupt>
  8:	0c 94 3e 00 	jmp	0x7c	; 0x7c <__bad_interrupt>

00000068 <__ctors_end>:
__trampolines_start():
  68:	11 24       	eor	r1, r1
  6a:	1f be       	out	0x3f, r1	; 63
  6c:	cf ef       	ldi	r28, 0xFF	; 255
  6e:	d8 e0       	ldi	r29, 0x08	; 8
  70:	de bf       	out	0x3e, r29	; 62
  72:	cd bf       	out	0x3d, r28	; 61
  74:	0e 94 40 00 	call	0x80	; 0x80 <main>
  78:	0c 94 57 00 	jmp	0xae	; 0xae <_exit>

0000007c <__bad_interrupt>:
__vector_22():
  7c:	0c 94 00 00 	jmp	0	; 0x0 <__vectors>

00000080 <main>:
main():
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:13

int main(void)
{
	int cnt;
	/* ポート初期化 */
	DDRD   = (U1)0xFFU; /* DDRD   :PORTD0-7出力設定 */
  80:	8f ef       	ldi	r24, 0xFF	; 255
  82:	8a b9       	out	0x0a, r24	; 10
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:14
	PORTD  = (U1)0x00U; /* PORTD  :PORTD0-7出力Low  */
  84:	1b b8       	out	0x0b, r1	; 11
init_timer():
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:51
}

/* タイマ初期化 */
static void init_timer(void)
{
	TCCR0A = (U1)0x02U;	 /* TCCR0A :OC0A,OC0B出力使用しない */
  86:	82 e0       	ldi	r24, 0x02	; 2
  88:	84 bd       	out	0x24, r24	; 36
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:52
	OCR0A  = (U1)0xF9U;	 /* OCR0A  :250カウント */
  8a:	89 ef       	ldi	r24, 0xF9	; 249
  8c:	87 bd       	out	0x27, r24	; 39
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:53
	TCNT0  = (U1)0x00U;	 /* TCNT0  :カウント初期値0 */
  8e:	16 bc       	out	0x26, r1	; 38
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:54
	TCCR0B = (U1)0x03U;	 /* TCCR0B :64分周, CTCモード */
  90:	83 e0       	ldi	r24, 0x03	; 3
  92:	85 bd       	out	0x25, r24	; 37
wait_1ms():
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:43
{
	/* 1ms経過判断(TIFR0.OCF0Aのbit値) */
	while((TIFR0 & (U1)_BV(OCF0A)) == (U1)0U);
	
	/* TIFR0.OCF0Aを0クリアする */
	TIFR0 = (U1)_BV(OCF0A);
  94:	22 e0       	ldi	r18, 0x02	; 2
main():
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:29
		cnt++;
		
		if(cnt>1000){
			cnt=0;
			/* PORTD0を反転出力する */
			PORTD ^= (U1)_BV(PORTD0);
  96:	31 e0       	ldi	r19, 0x01	; 1
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:10
/* 関数プロトタイプ宣言 */
static void wait_1ms(void);
static void init_timer(void);

int main(void)
{
  98:	89 ee       	ldi	r24, 0xE9	; 233
  9a:	93 e0       	ldi	r25, 0x03	; 3
wait_1ms():
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:40

/* 1msカウント */
static void wait_1ms(void)
{
	/* 1ms経過判断(TIFR0.OCF0Aのbit値) */
	while((TIFR0 & (U1)_BV(OCF0A)) == (U1)0U);
  9c:	a9 9b       	sbis	0x15, 1	; 21
  9e:	fe cf       	rjmp	.-4      	; 0x9c <main+0x1c>
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:43
	
	/* TIFR0.OCF0Aを0クリアする */
	TIFR0 = (U1)_BV(OCF0A);
  a0:	25 bb       	out	0x15, r18	; 21
  a2:	01 97       	sbiw	r24, 0x01	; 1
main():
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:26
	{
		/* 1ms経過まで待機する */
		wait_1ms();
		cnt++;
		
		if(cnt>1000){
  a4:	d9 f7       	brne	.-10     	; 0x9c <main+0x1c>
C:\\temp\\atmega168\\2_c\\GccApplication\\Debug/../src/main.c:29
			cnt=0;
			/* PORTD0を反転出力する */
			PORTD ^= (U1)_BV(PORTD0);
  a6:	8b b1       	in	r24, 0x0b	; 11
  a8:	83 27       	eor	r24, r19
  aa:	8b b9       	out	0x0b, r24	; 11
  ac:	f5 cf       	rjmp	.-22     	; 0x98 <main+0x18>

000000ae <_exit>:
exit():
  ae:	f8 94       	cli

000000b0 <__stop_program>:
__stop_program():
  b0:	ff cf       	rjmp	.-2      	; 0xb0 <__stop_program>
`.trim();

const C_SAMPLE_MAIN_CODE = `
#include "type_common.h"

#include <avr/io.h>

/* 関数プロトタイプ宣言 */
static void wait_1ms(void);
static void init_timer(void);

int main(void)
{
	int cnt;
	/* ポート初期化 */
	DDRD   = (U1)0xFFU; /* DDRD   :PORTD0-7出力設定 */
	PORTD  = (U1)0x00U; /* PORTD  :PORTD0-7出力Low  */
	
	/* タイマ初期化 */
	init_timer();

	cnt=0;
	while(1)
	{
		/* 1ms経過まで待機する */
		wait_1ms();
		cnt++;
		
		if(cnt>1000){
			cnt=0;
			/* PORTD0を反転出力する */
			PORTD ^= (U1)_BV(PORTD0);
		}
	}
	
	return 0;
}

/* 1msカウント */
static void wait_1ms(void)
{
	/* 1ms経過判断(TIFR0.OCF0Aのbit値) */
	while((TIFR0 & (U1)_BV(OCF0A)) == (U1)0U);
	
	/* TIFR0.OCF0Aを0クリアする */
	TIFR0 = (U1)_BV(OCF0A);
	
	return;
}

/* タイマ初期化 */
static void init_timer(void)
{
	TCCR0A = (U1)0x02U;	 /* TCCR0A :OC0A,OC0B出力使用しない */
	OCR0A  = (U1)0xF9U;	 /* OCR0A  :250カウント */
	TCNT0  = (U1)0x00U;	 /* TCNT0  :カウント初期値0 */
	TCCR0B = (U1)0x03U;	 /* TCCR0B :64分周, CTCモード */
	/* TCCR0B.CS0設定後にタイマ始動。カウントスタート */
	
	return;
}
`.trim();

function App() {
  const [hexInput, setHexInput] = useState(BLINK_HEX);
  const [lssInput, setLssInput] = useState('');
  const [sourceFiles, setSourceFiles] = useState<{ name: string, content: string }[]>([]);
  const [program, setProgram] = useState<Uint16Array | null>(null);
  const { emulator, isRunning, breakpoints, sourceMapper, fileManager, start, stop, step, reset, toggleBreakpoint, toggleLineBreakpoint } = useEmulator(program, lssInput, sourceFiles);
  const [noResetMode, setNoResetMode] = useState(true);
  const [debugInfo, setDebugInfo] = useState({ pc: 0, cycles: 0 });
  const [viewMode, setViewMode] = useState<'disassembly' | 'source'>('source');
  const [showAsmInSource, setShowAsmInSource] = useState(false);

  const [activeTabFilename, setActiveTabFilename] = useState<string | null>(null);

  useEffect(() => {
    try {
      setProgram(parseHex(hexInput));
    } catch (e) {
      console.error('HEX Parse Error:', e);
    }
  }, [hexInput]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (emulator) {
        setDebugInfo({
          pc: emulator.cpu.pc,
          cycles: emulator.cpu.cycles
        });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [emulator]);

  const addSourceFile = () => {
    const name = prompt('ファイル名を入力してください (例: main.c):');
    if (name) {
      if (sourceFiles.find(f => f.name === name)) {
        alert('そのファイル名は既に存在します');
        return;
      }
      setSourceFiles([...sourceFiles, { name, content: '' }]);
      setActiveTabFilename(name);
    }
  };

  const removeSourceFile = (name: string) => {
    setSourceFiles(sourceFiles.filter(f => f.name !== name));
    if (activeTabFilename === name) {
      setActiveTabFilename(null);
    }
  };

  const updateSourceFileContent = (content: string) => {
    if (activeTabFilename) {
      setSourceFiles(sourceFiles.map(f => f.name === activeTabFilename ? { ...f, content } : f));
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newSourceFiles: { name: string; content: string }[] = [];
    const validSourceExtensions = ['.c', '.h', '.cpp', '.hpp', '.s', '.asm'];
    let detectedHex: string | null = null;
    let detectedLss: string | null = null;

    // デコード用の関数
    const decodeFile = async (file: File): Promise<string> => {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        return utf8Decoder.decode(uint8Array);
      } catch (e) {
        const sjisDecoder = new TextDecoder('windows-31j');
        return sjisDecoder.decode(uint8Array);
      }
    };

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = (file as any).webkitRelativePath || file.name;
        // プロジェクトルート名（一番上のフォルダ名）を削る
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
        }
    }

    if (newSourceFiles.length > 0 || detectedHex || detectedLss) {
      let msg = '';
      if (newSourceFiles.length > 0) msg += `${newSourceFiles.length} 個のソースファイル`;
      if (detectedHex) msg += (msg ? '、' : '') + 'HEXファイル';
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
        setSourceFiles(newSourceFiles);
      }

      if (detectedHex) setHexInput(detectedHex);
      if (detectedLss) setLssInput(detectedLss);

      if (newSourceFiles.length > 0 && !activeTabFilename) {
        setActiveTabFilename(newSourceFiles[0].name);
      } else if (detectedHex && !activeTabFilename) {
          // ソースがない場合でも何か表示させるためのケア
      }
    } else {
      alert('有効なファイル（.c, .h, .hex, .lss 等）が見つかりませんでした。');
    }

    e.target.value = '';
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Arduino/Atmega328P Simulator</h1>
        <div className="controls">
          <button onClick={isRunning ? stop : start}>
            {isRunning ? '一時停止' : '実行'}
          </button>
          {!isRunning && (
            <button onClick={step} style={{ marginLeft: '0.5rem' }}>ステップ</button>
          )}
          <button onClick={reset} style={{ marginLeft: '0.5rem' }}>リセット</button>
        </div>
      </header>

      <div className="main-layout">
        <main className="main-content">
          <div className="card">
            <h2>Arduino Board (Emulated)</h2>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', padding: '1rem' }}>
              <Pin13Led portB={emulator?.portB} />
              <div className="board-info">
                <p>MCU: ATmega328P</p>
                <p>Clock: 16MHz</p>
                <p>Status: {isRunning ? 'Running' : 'Stopped'}</p>
                <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>
                  PC: 0x{debugInfo.pc.toString(16).padStart(4, '0')} |
                  Cycles: {debugInfo.cycles.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <SerialConsole
              uart={emulator?.uart}
              onReset={reset}
              noResetMode={noResetMode}
            />
          </div>

          <div className="card">
            <HardwarePanel emulator={emulator} isRunning={isRunning} />
          </div>
        </main>

        <aside className="disassembly-sidebar">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>
            <CpuStatePanel emulator={emulator} isRunning={isRunning} />
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="radio" value="source" checked={viewMode === 'source'} onChange={(e) => setViewMode(e.target.value as any)} /> Source
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="radio" value="disassembly" checked={viewMode === 'disassembly'} onChange={(e) => setViewMode(e.target.value as any)} /> Disassembly
                </label>
              </div>
              {viewMode === 'source' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <input type="checkbox" checked={showAsmInSource} onChange={(e) => setShowAsmInSource(e.target.checked)} /> Show ASM
                </label>
              )}
            </div>
            {viewMode === 'source' ? (
              <SourceViewer
                sourceMapper={sourceMapper}
                fileManager={fileManager}
                pc={isRunning ? -1 : debugInfo.pc}
                isRunning={isRunning}
                breakpoints={breakpoints}
                onToggleBreakpoint={toggleBreakpoint}
                onToggleLineBreakpoint={toggleLineBreakpoint}
                showAssembly={showAsmInSource}
              />
            ) : (
              <DisassemblyPanel
                program={program}
                pc={isRunning ? -1 : debugInfo.pc}
                isRunning={isRunning}
                breakpoints={breakpoints}
                onToggleBreakpoint={toggleBreakpoint}
              />
            )}
          </div>
        </aside>

        <aside className="sidebar">
          <div className="card">
            <h3>設定</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={noResetMode}
                  onChange={(e) => setNoResetMode(e.target.checked)}
                />
                RESET EN 切断モード (リセットなし)
              </label>
              <button
                onClick={() => {
                  localStorage.removeItem('arduino_sim_hardware_config');
                  window.location.reload();
                }}
                style={{ background: '#475569', fontSize: '0.8rem', padding: '0.5rem' }}
              >
                ハードウェア設定を初期化
              </button>
            </div>
          </div>

          <div className="card hex-upload">
            <h3>HEX & LSS プログラム</h3>
            <div className="buttons">
              <button onClick={() => { setHexInput(BLINK_HEX); setLssInput(''); setSourceFiles([]); }}>
                Blink (Lチカ)
              </button>
              <button onClick={() => { setHexInput(SERIAL_ECHO_HEX); setLssInput(''); setSourceFiles([]); }}>
                Serial Echo (エコーバック)
              </button>
              <button onClick={() => { setHexInput(BLINK2_HEX); setLssInput(''); setSourceFiles([]); }}>
                Blink2 (Lチカ)
              </button>
              <button onClick={() => { setHexInput(PUSH_SWITCH_HEX); setLssInput(''); setSourceFiles([]); }}>
                Push Switch (プッシュスイッチ)
              </button>
              <button onClick={() => { setHexInput(POT_BLINK_HEX); setLssInput(''); setSourceFiles([]); }}>
                Potentiometer (可変抵抗)
              </button>
              <button onClick={() => { setHexInput(SEVEN_SEGMENT_HEX); setLssInput(''); setSourceFiles([]); }}>
                7-Segment (7セグ)
              </button>
              <button onClick={() => { setHexInput(SEVEN_SEGMENT_COUNTUP_HEX); setLssInput(''); setSourceFiles([]); }}>
                7-Segment Countup (7セグカウントアップ)
              </button>
              <button onClick={() => { setHexInput(MOTOR_PWM_HEX); setLssInput(''); setSourceFiles([]); }}>
                DC Motor PWM (モーター)
              </button>
              <button onClick={() => { setHexInput(LCD_HELLO_HEX); setLssInput(''); setSourceFiles([]); }}>
                LCD 1602 Hello (液晶)
              </button>
              <button onClick={() => { setHexInput(ANALOG_A0_TO_7SEG_HEX); setLssInput(''); setSourceFiles([]); }}>
                Analog A0 to 7-Segment (アナログA0から7セグ)
              </button>
              <button onClick={() => {
                setHexInput(C_SAMPLE_HEX);
                setLssInput(C_SAMPLE_LSS);
                setSourceFiles([{ name: 'main.c', content: C_SAMPLE_MAIN_CODE }]);
                setActiveTabFilename('main.c');
              }} style={{ background: '#059669' }}>
                C Sample (Lチカ) ★NEW
              </button>
              <button onClick={async () => {
                try {
                  const response = await fetch('/samples/hybrid_system.json');
                  const data = await response.json();
                  setHexInput(data.hex);
                  setLssInput(data.lss);
                  setSourceFiles(data.sourceFiles);
                  if (data.sourceFiles.length > 0) {
                    setActiveTabFilename(data.sourceFiles[0].name);
                  }
                  if (data.hardwareConfigs) {
                    localStorage.setItem('arduino_sim_hardware_config', JSON.stringify(data.hardwareConfigs));
                    window.dispatchEvent(new Event('hardwareConfigChanged'));
                  }
                  alert('Hybrid System プリセットをロードしました');
                } catch (e) {
                  console.error('Preset Load Error:', e);
                  alert('プリセットのロードに失敗しました');
                }
              }} style={{ background: '#7c3aed' }}>
                Hybrid System ★PRESET
              </button>
              <button onClick={async () => {
                try {
                  const response = await fetch('/samples/lcd_test.json');
                  const data = await response.json();
                  setHexInput(data.hex);
                  setLssInput(data.lss);
                  setSourceFiles(data.sourceFiles);
                  if (data.sourceFiles.length > 0) {
                    setActiveTabFilename(data.sourceFiles[0].name);
                  }
                  if (data.hardwareConfigs) {
                    localStorage.setItem('arduino_sim_hardware_config', JSON.stringify(data.hardwareConfigs));
                    window.dispatchEvent(new Event('hardwareConfigChanged'));
                  }
                  alert('LCD Debug プリセットをロードしました');
                } catch (e) {
                  console.error('Preset Load Error:', e);
                  alert('プリセットのロードに失敗しました');
                }
              }} style={{ background: '#ec4899', marginLeft: '0.2rem' }}>
                LCD Debug ★PRESET
              </button>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Intel HEX:</label>
              <textarea
                rows={3}
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="Intel HEX"
              />
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>LSSファイル:</label>
              <textarea
                rows={3}
                value={lssInput}
                onChange={(e) => setLssInput(e.target.value)}
                placeholder="LSSファイル"
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cソースコード群:</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={addSourceFile} style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#3b82f6' }}>追加</button>
                  <button
                    onClick={() => document.getElementById('folder-upload')?.click()}
                    style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#10b981' }}
                  >
                    フォルダを追加
                  </button>
                  <input
                    id="folder-upload"
                    type="file"
                    onChange={handleFolderUpload}
                    style={{ display: 'none' }}
                    {...({ webkitdirectory: "", directory: "" } as any)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {sourceFiles.map(file => (
                  <div
                    key={file.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: activeTabFilename === file.name ? '#3b82f6' : '#334155',
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveTabFilename(file.name)}
                  >
                    <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSourceFile(file.name); }}
                      style={{ background: 'transparent', border: 'none', color: '#fff', marginLeft: '4px', padding: '0 2px', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {activeTabFilename && (
                <textarea
                  rows={10}
                  value={sourceFiles.find(f => f.name === activeTabFilename)?.content || ''}
                  onChange={(e) => updateSourceFileContent(e.target.value)}
                  placeholder={`${activeTabFilename} の内容を入力...`}
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
