import { SourceFileManager } from './SourceFileManager';

export interface SourceMapLocation {
    fileName: string;
    lineNumber: number;
}

export class SourceMapper {
    public addressToLocation: Map<number, SourceMapLocation> = new Map(); // PC address (byte) -> Location
    public fileToLineToAddresses: Map<string, Map<number, number[]>> = new Map(); // fileName -> lineNumber -> addresses
    public hasSource: boolean = false;

    public parseLss(lssText: string, fileManager: SourceFileManager) {
        this.addressToLocation.clear();
        this.fileToLineToAddresses.clear();
        this.hasSource = false;

        const lines = lssText.split(/\r?\n/);

        let currentFile: string | undefined = undefined;
        let currentLineNumber: number = -1;

        // LSS解析用の正規表現
        const addressRowRegex = /^\s*([0-9a-fA-F]+):\s+([0-9a-fA-F]{2}\s+)+/;
        const functionLabelRegex = /^[0-9a-fA-F]+\s+<([^>]+)>:$/;
        const fileLineDirectiveRegex = /^([^:]+\.[chSH]):(\d+)(?:\s*(.*))?$/;

        for (const line of lines) {
            // 1. ファイル:行番号 ディレクティブのチェック (avr-objdump -l の場合)
            const fileLineMatch = line.match(fileLineDirectiveRegex);
            if (fileLineMatch) {
                const fullPath = fileLineMatch[1];
                const fileName = fullPath.split(/[/\\]/).pop() || fullPath;
                const lineNum = parseInt(fileLineMatch[2], 10);

                if (fileManager.getFile(fileName)) {
                    currentFile = fileName;
                    currentLineNumber = lineNum;
                }
                continue;
            }

            // 2. 関数ラベルのチェック (00000080 <main>:)
            const funcMatch = line.match(functionLabelRegex);
            if (funcMatch) {
                const funcName = funcMatch[1];
                const def = fileManager.findFunctionDefinition(funcName);
                if (def) {
                    currentFile = def.fileName;
                    currentLineNumber = def.lineNumber;
                }
                continue;
            }

            // 3. アドレス行のチェック
            const addrMatch = line.match(addressRowRegex);
            if (addrMatch) {
                const byteAddress = parseInt(addrMatch[1], 16);
                if (currentFile && currentLineNumber !== -1) {
                    this.mapAddress(byteAddress, currentFile, currentLineNumber);
                }
            } else {
                // 4. 空行でない場合、Cソースコードそのものが書かれている可能性があるため、照合を試みる
                const trimmed = line.trim();
                if (trimmed !== '' && !line.startsWith('Sections:') && !line.startsWith('Disassembly')) {
                    const found = fileManager.findCodeFragment(line, currentFile);
                    if (found) {
                        currentFile = found.fileName;
                        currentLineNumber = found.lineNumber;
                    }
                }
            }
        }

        this.hasSource = this.addressToLocation.size > 0;
    }

    private mapAddress(address: number, fileName: string, lineNumber: number) {
        this.addressToLocation.set(address, { fileName, lineNumber });

        if (!this.fileToLineToAddresses.has(fileName)) {
            this.fileToLineToAddresses.set(fileName, new Map());
        }
        const lineMap = this.fileToLineToAddresses.get(fileName)!;
        if (!lineMap.has(lineNumber)) {
            lineMap.set(lineNumber, []);
        }
        lineMap.get(lineNumber)!.push(address);
    }

    public getLocationForAddress(address: number): SourceMapLocation | undefined {
        return this.addressToLocation.get(address);
    }

    public getAddressesForLocation(fileName: string, lineNumber: number): number[] {
        return this.fileToLineToAddresses.get(fileName)?.get(lineNumber) || [];
    }
}
