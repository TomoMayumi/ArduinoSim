export function parseHex(hex: string): Uint16Array {
    const lines = hex.split(/\r?\n/);
    const flash = new Uint8Array(32768); // ATmega328P has 32KB Flash
    let highAddress = 0;

    for (const line of lines) {
        if (line.startsWith(':')) {
            const length = parseInt(line.substr(1, 2), 16);
            const address = parseInt(line.substr(3, 4), 16) + highAddress;
            const type = parseInt(line.substr(7, 2), 16);
            const data = line.substr(9, length * 2);

            if (type === 0) {
                // Data record
                for (let i = 0; i < length; i++) {
                    flash[address + i] = parseInt(data.substr(i * 2, 2), 16);
                }
            } else if (type === 4) {
                // Extended Linear Address Record
                highAddress = parseInt(data, 16) << 16;
            }
        }
    }

    // Convert to words (Uint16Array)
    const flash16 = new Uint16Array(16384);
    for (let i = 0; i < flash16.length; i++) {
        flash16[i] = flash[i * 2] | (flash[i * 2 + 1] << 8);
    }

    return flash16;
}
