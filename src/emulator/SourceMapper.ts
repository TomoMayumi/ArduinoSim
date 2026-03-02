export interface SourceLine {
    lineNumber: number;       // 表示上の行番号 (1-indexed)
    text: string;             // 行のテキスト
    addresses: number[];      // この行に含まれるPCアドレス(バイト単位)のリスト
    isAssembly: boolean;      // アセンブリ(逆アセ)行かどうか
}

export class SourceMapper {
    public sourceLines: SourceLine[] = [];
    public addressToRawLine: Map<number, number> = new Map(); // PC address (byte) -> Raw LSS lineNumber
    public addressToSourceLine: Map<number, number> = new Map(); // PC address (byte) -> C source lineNumber
    public hasSource: boolean = false;

    public parseLss(lssText: string) {
        this.sourceLines = [];
        this.addressToRawLine.clear();
        this.addressToSourceLine.clear();
        this.hasSource = false;

        const lines = lssText.split(/\r?\n/);
        let currentLineNumber = 1;

        // LSSファイルの解析
        const addressRowRegex = /^\s*([0-9a-fA-F]+):\s+([0-9a-fA-F]{2}\s+)+/;

        let lastSourceLineNumber = -1;

        for (const line of lines) {
            const match = line.match(addressRowRegex);
            const addresses: number[] = [];
            let isAssembly = false;

            if (match) {
                // アドレス行の場合
                isAssembly = true;
                const byteAddress = parseInt(match[1], 16);
                addresses.push(byteAddress);

                this.addressToRawLine.set(byteAddress, currentLineNumber);
                if (lastSourceLineNumber !== -1) {
                    this.addressToSourceLine.set(byteAddress, lastSourceLineNumber);
                    this.sourceLines[lastSourceLineNumber - 1].addresses.push(byteAddress);
                }
            } else {
                // アドレス以外の行（Cのソースコード、セクションラベル、空行など）
                isAssembly = false;
                if (line.trim() !== '') {
                    lastSourceLineNumber = currentLineNumber;
                }
            }

            this.sourceLines.push({
                lineNumber: currentLineNumber,
                text: line,
                addresses: addresses,
                isAssembly
            });

            currentLineNumber++;
        }

        this.hasSource = this.sourceLines.length > 0;
    }

    public getLineForAddress(address: number): number | undefined {
        return this.addressToRawLine.get(address);
    }

    public getSourceLineForAddress(address: number): number | undefined {
        return this.addressToSourceLine.get(address);
    }

    public getAddressesForLine(lineNumber: number): number[] {
        if (lineNumber >= 1 && lineNumber <= this.sourceLines.length) {
            return this.sourceLines[lineNumber - 1].addresses;
        }
        return [];
    }
}
