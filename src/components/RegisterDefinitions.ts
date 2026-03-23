export interface BitFieldDef {
    name: string;
    bits: number[];   // ビット位置の配列 (例: [7,6] = bit7:6)
    description?: string;
    readonly?: boolean;
}

export interface RegisterDef {
    name: string;
    addr: number;
    bitFields?: BitFieldDef[];
    /** データ空間外の特殊レジスタ */
    special?: 'pc' | 'sp' | 'x' | 'y' | 'z';
    /** ビット幅 (デフォルト: 8) */
    bitWidth?: number;
    readonly?: boolean;
}

export interface RegisterGroup {
    id: string;
    label: string;
    registers: RegisterDef[];
}

/** ビットフィールドから値を抽出する */
export function extractBitFieldValue(regValue: number, bits: number[]): number {
    let result = 0;
    for (let i = 0; i < bits.length; i++) {
        const bitPos = bits[i];
        const bitVal = (regValue >> bitPos) & 1;
        result |= bitVal << (bits.length - 1 - i);
    }
    return result;
}

// --- PORT ビットフィールド生成ヘルパー ---
const portBits = (prefix: string, count: number, isReadonly: boolean = false): BitFieldDef[] => {
    const fields: BitFieldDef[] = [];
    for (let i = count - 1; i >= 0; i--) {
        const def: BitFieldDef = { name: `${prefix}${i}`, bits: [i] };
        if (isReadonly) def.readonly = true;
        fields.push(def);
    }
    return fields;
};

// --- 汎用レジスタ R0-R31 生成ヘルパー ---
const gprRegisters = (): RegisterDef[] => {
    const regs: RegisterDef[] = [];
    for (let i = 0; i < 32; i++) {
        regs.push({ name: `R${i}`, addr: i });
    }
    return regs;
};

// ========== CPU レジスタグループ ==========
export const CPU_GROUPS: RegisterGroup[] = [
    {
        id: 'cpu', label: 'CPU Core', registers: [
            { name: 'PC', addr: -1, special: 'pc', bitWidth: 16 },
            { name: 'SP', addr: -1, special: 'sp', bitWidth: 16 },
            {
                name: 'SREG', addr: 0x5F, bitFields: [
                    { name: 'I', bits: [7], description: 'Global Interrupt Enable' },
                    { name: 'T', bits: [6], description: 'Bit Copy Storage' },
                    { name: 'H', bits: [5], description: 'Half Carry Flag' },
                    { name: 'S', bits: [4], description: 'Sign Bit' },
                    { name: 'V', bits: [3], description: 'Two\'s Complement Overflow Flag' },
                    { name: 'N', bits: [2], description: 'Negative Flag' },
                    { name: 'Z', bits: [1], description: 'Zero Flag' },
                    { name: 'C', bits: [0], description: 'Carry Flag' },
                ]
            },
        ]
    },
    {
        id: 'gpr', label: '汎用レジスタ (R0-R31)', registers: [
            ...gprRegisters(),
            { name: 'X (R27:R26)', addr: -1, special: 'x', bitWidth: 16 },
            { name: 'Y (R29:R28)', addr: -1, special: 'y', bitWidth: 16 },
            { name: 'Z (R31:R30)', addr: -1, special: 'z', bitWidth: 16 },
        ]
    },
];

export const PERIPHERAL_GROUPS: RegisterGroup[] = [
    // ========== PORT B/C/D ==========
    {
        id: 'portb', label: 'PORT B', registers: [
            { name: 'PORTB', addr: 0x25, bitFields: portBits('PORTB', 8) },
            { name: 'DDRB',  addr: 0x24, bitFields: portBits('DDB', 8) },
            { name: 'PINB',  addr: 0x23, bitFields: portBits('PINB', 8, true), readonly: true }
        ]
    },
    {
        id: 'portc', label: 'PORT C', registers: [
            { name: 'PORTC', addr: 0x28, bitFields: portBits('PORTC', 7) },
            { name: 'DDRC',  addr: 0x27, bitFields: portBits('DDC', 7) },
            { name: 'PINC',  addr: 0x26, bitFields: portBits('PINC', 7, true), readonly: true }
        ]
    },
    {
        id: 'portd', label: 'PORT D', registers: [
            { name: 'PORTD', addr: 0x2B, bitFields: portBits('PORTD', 8) },
            { name: 'DDRD',  addr: 0x2A, bitFields: portBits('DDD', 8) },
            { name: 'PIND',  addr: 0x29, bitFields: portBits('PIND', 8, true), readonly: true }
        ]
    },

    // ========== Timer/Counter 0 ==========
    {
        id: 'timer0', label: 'Timer/Counter 0', registers: [
            {
                name: 'TCCR0A', addr: 0x44, bitFields: [
                    { name: 'COM0A', bits: [7, 6], description: 'Compare Match Output A Mode' },
                    { name: 'COM0B', bits: [5, 4], description: 'Compare Match Output B Mode' },
                    { name: 'WGM0[1:0]', bits: [1, 0], description: 'Waveform Generation Mode (低位)' },
                ]
            },
            {
                name: 'TCCR0B', addr: 0x45, bitFields: [
                    { name: 'FOC0A', bits: [7], description: 'Force Output Compare A' },
                    { name: 'FOC0B', bits: [6], description: 'Force Output Compare B' },
                    { name: 'WGM02', bits: [3], description: 'Waveform Generation Mode (高位)' },
                    { name: 'CS0', bits: [2, 1, 0], description: 'Clock Select' },
                ]
            },
            { name: 'TCNT0',  addr: 0x46 },
            { name: 'OCR0A',  addr: 0x47 },
            { name: 'OCR0B',  addr: 0x48 },
            {
                name: 'TIMSK0', addr: 0x6E, bitFields: [
                    { name: 'OCIE0B', bits: [2], description: 'Output Compare B Match Interrupt Enable' },
                    { name: 'OCIE0A', bits: [1], description: 'Output Compare A Match Interrupt Enable' },
                    { name: 'TOIE0',  bits: [0], description: 'Overflow Interrupt Enable' },
                ]
            },
            {
                name: 'TIFR0', addr: 0x35, readonly: true, bitFields: [
                    { name: 'OCF0B', bits: [2], description: 'Output Compare B Match Flag', readonly: true },
                    { name: 'OCF0A', bits: [1], description: 'Output Compare A Match Flag', readonly: true },
                    { name: 'TOV0',  bits: [0], description: 'Overflow Flag', readonly: true },
                ]
            }
        ]
    },

    // ========== Timer/Counter 1 ==========
    {
        id: 'timer1', label: 'Timer/Counter 1', registers: [
            {
                name: 'TCCR1A', addr: 0x80, bitFields: [
                    { name: 'COM1A', bits: [7, 6], description: 'Compare Output Mode for Channel A' },
                    { name: 'COM1B', bits: [5, 4], description: 'Compare Output Mode for Channel B' },
                    { name: 'WGM1[1:0]', bits: [1, 0], description: 'Waveform Generation Mode (低位)' },
                ]
            },
            {
                name: 'TCCR1B', addr: 0x81, bitFields: [
                    { name: 'ICNC1', bits: [7], description: 'Input Capture Noise Canceler' },
                    { name: 'ICES1', bits: [6], description: 'Input Capture Edge Select' },
                    { name: 'WGM1[3:2]', bits: [4, 3], description: 'Waveform Generation Mode (高位)' },
                    { name: 'CS1', bits: [2, 1, 0], description: 'Clock Select' },
                ]
            },
            {
                name: 'TCCR1C', addr: 0x82, bitFields: [
                    { name: 'FOC1A', bits: [7], description: 'Force Output Compare A' },
                    { name: 'FOC1B', bits: [6], description: 'Force Output Compare B' },
                ]
            },
            { name: 'TCNT1H', addr: 0x85 },
            { name: 'TCNT1L', addr: 0x84 },
            { name: 'OCR1AH', addr: 0x89 },
            { name: 'OCR1AL', addr: 0x88 },
            { name: 'OCR1BH', addr: 0x8B },
            { name: 'OCR1BL', addr: 0x8A },
            { name: 'ICR1H',  addr: 0x87 },
            { name: 'ICR1L',  addr: 0x86 },
            {
                name: 'TIMSK1', addr: 0x6F, bitFields: [
                    { name: 'ICIE1',  bits: [5], description: 'Input Capture Interrupt Enable' },
                    { name: 'OCIE1B', bits: [2], description: 'Output Compare B Match Interrupt Enable' },
                    { name: 'OCIE1A', bits: [1], description: 'Output Compare A Match Interrupt Enable' },
                    { name: 'TOIE1',  bits: [0], description: 'Overflow Interrupt Enable' },
                ]
            },
            {
                name: 'TIFR1', addr: 0x36, readonly: true, bitFields: [
                    { name: 'ICF1',  bits: [5], description: 'Input Capture Flag', readonly: true },
                    { name: 'OCF1B', bits: [2], description: 'Output Compare B Match Flag', readonly: true },
                    { name: 'OCF1A', bits: [1], description: 'Output Compare A Match Flag', readonly: true },
                    { name: 'TOV1',  bits: [0], description: 'Overflow Flag', readonly: true },
                ]
            }
        ]
    },

    // ========== Timer/Counter 2 ==========
    {
        id: 'timer2', label: 'Timer/Counter 2', registers: [
            {
                name: 'TCCR2A', addr: 0xB0, bitFields: [
                    { name: 'COM2A', bits: [7, 6], description: 'Compare Match Output A Mode' },
                    { name: 'COM2B', bits: [5, 4], description: 'Compare Match Output B Mode' },
                    { name: 'WGM2[1:0]', bits: [1, 0], description: 'Waveform Generation Mode (低位)' },
                ]
            },
            {
                name: 'TCCR2B', addr: 0xB1, bitFields: [
                    { name: 'FOC2A', bits: [7], description: 'Force Output Compare A' },
                    { name: 'FOC2B', bits: [6], description: 'Force Output Compare B' },
                    { name: 'WGM22', bits: [3], description: 'Waveform Generation Mode (高位)' },
                    { name: 'CS2', bits: [2, 1, 0], description: 'Clock Select' },
                ]
            },
            { name: 'TCNT2',  addr: 0xB2 },
            { name: 'OCR2A',  addr: 0xB3 },
            { name: 'OCR2B',  addr: 0xB4 },
            {
                name: 'TIMSK2', addr: 0x70, bitFields: [
                    { name: 'OCIE2B', bits: [2], description: 'Output Compare B Match Interrupt Enable' },
                    { name: 'OCIE2A', bits: [1], description: 'Output Compare A Match Interrupt Enable' },
                    { name: 'TOIE2',  bits: [0], description: 'Overflow Interrupt Enable' },
                ]
            },
            {
                name: 'TIFR2', addr: 0x37, readonly: true, bitFields: [
                    { name: 'OCF2B', bits: [2], description: 'Output Compare B Match Flag', readonly: true },
                    { name: 'OCF2A', bits: [1], description: 'Output Compare A Match Flag', readonly: true },
                    { name: 'TOV2',  bits: [0], description: 'Overflow Flag', readonly: true },
                ]
            },
            {
                name: 'ASSR', addr: 0xB6, bitFields: [
                    { name: 'EXCLK',  bits: [6], description: 'Enable External Clock Input' },
                    { name: 'AS2',    bits: [5], description: 'Asynchronous Timer/Counter2' },
                    { name: 'TCN2UB', bits: [4], description: 'TCNT2 Update Busy' },
                    { name: 'OCR2AUB', bits: [3], description: 'OCR2A Update Busy' },
                    { name: 'OCR2BUB', bits: [2], description: 'OCR2B Update Busy' },
                    { name: 'TCR2AUB', bits: [1], description: 'TCCR2A Update Busy' },
                    { name: 'TCR2BUB', bits: [0], description: 'TCCR2B Update Busy' },
                ]
            }
        ]
    },

    // ========== USART 0 ==========
    {
        id: 'usart0', label: 'USART 0', registers: [
            { name: 'UDR0', addr: 0xC6 },
            {
                name: 'UCSR0A', addr: 0xC0, bitFields: [
                    { name: 'RXC0',  bits: [7], description: 'USART Receive Complete', readonly: true },
                    { name: 'TXC0',  bits: [6], description: 'USART Transmit Complete' },
                    { name: 'UDRE0', bits: [5], description: 'USART Data Register Empty', readonly: true },
                    { name: 'FE0',   bits: [4], description: 'Frame Error', readonly: true },
                    { name: 'DOR0',  bits: [3], description: 'Data OverRun', readonly: true },
                    { name: 'UPE0',  bits: [2], description: 'USART Parity Error', readonly: true },
                    { name: 'U2X0',  bits: [1], description: 'Double USART Transmission Speed' },
                    { name: 'MPCM0', bits: [0], description: 'Multi-processor Communication Mode' },
                ]
            },
            {
                name: 'UCSR0B', addr: 0xC1, bitFields: [
                    { name: 'RXCIE0', bits: [7], description: 'RX Complete Interrupt Enable' },
                    { name: 'TXCIE0', bits: [6], description: 'TX Complete Interrupt Enable' },
                    { name: 'UDRIE0', bits: [5], description: 'Data Register Empty Interrupt Enable' },
                    { name: 'RXEN0',  bits: [4], description: 'Receiver Enable' },
                    { name: 'TXEN0',  bits: [3], description: 'Transmitter Enable' },
                    { name: 'UCSZ02', bits: [2], description: 'Character Size (高位)' },
                    { name: 'RXB80',  bits: [1], description: 'Receive Data Bit 8' },
                    { name: 'TXB80',  bits: [0], description: 'Transmit Data Bit 8' },
                ]
            },
            {
                name: 'UCSR0C', addr: 0xC2, bitFields: [
                    { name: 'UMSEL0', bits: [7, 6], description: 'USART Mode Select' },
                    { name: 'UPM0',   bits: [5, 4], description: 'Parity Mode' },
                    { name: 'USBS0',  bits: [3], description: 'Stop Bit Select' },
                    { name: 'UCSZ0[1:0]', bits: [2, 1], description: 'Character Size (低位)' },
                    { name: 'UCPOL0', bits: [0], description: 'Clock Polarity' },
                ]
            },
            { name: 'UBRR0H', addr: 0xC5 },
            { name: 'UBRR0L', addr: 0xC4 }
        ]
    },

    // ========== ADC ==========
    {
        id: 'adc', label: 'ADC', registers: [
            {
                name: 'ADMUX', addr: 0x7C, bitFields: [
                    { name: 'REFS', bits: [7, 6], description: 'Reference Selection' },
                    { name: 'ADLAR', bits: [5], description: 'ADC Left Adjust Result' },
                    { name: 'MUX', bits: [3, 2, 1, 0], description: 'Analog Channel Selection' },
                ]
            },
            {
                name: 'ADCSRA', addr: 0x7A, bitFields: [
                    { name: 'ADEN',  bits: [7], description: 'ADC Enable' },
                    { name: 'ADSC',  bits: [6], description: 'ADC Start Conversion' },
                    { name: 'ADATE', bits: [5], description: 'ADC Auto Trigger Enable' },
                    { name: 'ADIF',  bits: [4], description: 'ADC Interrupt Flag' },
                    { name: 'ADIE',  bits: [3], description: 'ADC Interrupt Enable' },
                    { name: 'ADPS',  bits: [2, 1, 0], description: 'ADC Prescaler Select' },
                ]
            },
            {
                name: 'ADCSRB', addr: 0x7B, bitFields: [
                    { name: 'ACME', bits: [6], description: 'Analog Comparator Multiplexer Enable' },
                    { name: 'ADTS', bits: [2, 1, 0], description: 'ADC Auto Trigger Source' },
                ]
            },
            { name: 'ADCH',  addr: 0x79, readonly: true },
            { name: 'ADCL',  addr: 0x78, readonly: true },
            {
                name: 'DIDR0', addr: 0x7E, bitFields: [
                    { name: 'ADC5D', bits: [5], description: 'ADC5 Digital Input Disable' },
                    { name: 'ADC4D', bits: [4], description: 'ADC4 Digital Input Disable' },
                    { name: 'ADC3D', bits: [3], description: 'ADC3 Digital Input Disable' },
                    { name: 'ADC2D', bits: [2], description: 'ADC2 Digital Input Disable' },
                    { name: 'ADC1D', bits: [1], description: 'ADC1 Digital Input Disable' },
                    { name: 'ADC0D', bits: [0], description: 'ADC0 Digital Input Disable' },
                ]
            }
        ]
    },

    // ========== SPI ==========
    {
        id: 'spi', label: 'SPI', registers: [
            {
                name: 'SPCR', addr: 0x4C, bitFields: [
                    { name: 'SPIE', bits: [7], description: 'SPI Interrupt Enable' },
                    { name: 'SPE',  bits: [6], description: 'SPI Enable' },
                    { name: 'DORD', bits: [5], description: 'Data Order' },
                    { name: 'MSTR', bits: [4], description: 'Master/Slave Select' },
                    { name: 'CPOL', bits: [3], description: 'Clock Polarity' },
                    { name: 'CPHA', bits: [2], description: 'Clock Phase' },
                    { name: 'SPR',  bits: [1, 0], description: 'SPI Clock Rate Select' },
                ]
            },
            {
                name: 'SPSR', addr: 0x4D, bitFields: [
                    { name: 'SPIF',  bits: [7], description: 'SPI Interrupt Flag' },
                    { name: 'WCOL',  bits: [6], description: 'Write COLlision Flag' },
                    { name: 'SPI2X', bits: [0], description: 'Double SPI Speed' },
                ]
            },
            { name: 'SPDR', addr: 0x4E }
        ]
    },

    // ========== TWI (I2C) ==========
    {
        id: 'twi', label: 'TWI (I2C)', registers: [
            { name: 'TWBR', addr: 0xB8 },
            {
                name: 'TWSR', addr: 0xB9, bitFields: [
                    { name: 'TWS', bits: [7, 6, 5, 4, 3], description: 'TWI Status' },
                    { name: 'TWPS', bits: [1, 0], description: 'TWI Prescaler' },
                ]
            },
            {
                name: 'TWAR', addr: 0xBA, bitFields: [
                    { name: 'TWA', bits: [7, 6, 5, 4, 3, 2, 1], description: 'TWI Slave Address' },
                    { name: 'TWGCE', bits: [0], description: 'TWI General Call Recognition Enable' },
                ]
            },
            { name: 'TWDR', addr: 0xBB },
            {
                name: 'TWCR', addr: 0xBC, bitFields: [
                    { name: 'TWINT', bits: [7], description: 'TWI Interrupt Flag' },
                    { name: 'TWEA',  bits: [6], description: 'TWI Enable Acknowledge' },
                    { name: 'TWSTA', bits: [5], description: 'TWI START Condition' },
                    { name: 'TWSTO', bits: [4], description: 'TWI STOP Condition' },
                    { name: 'TWWC',  bits: [3], description: 'TWI Write Collision Flag' },
                    { name: 'TWEN',  bits: [2], description: 'TWI Enable' },
                    { name: 'TWIE',  bits: [0], description: 'TWI Interrupt Enable' },
                ]
            },
            {
                name: 'TWAMR', addr: 0xBD, bitFields: [
                    { name: 'TWAM', bits: [7, 6, 5, 4, 3, 2, 1], description: 'TWI Address Mask' },
                ]
            }
        ]
    },

    // ========== EEPROM ==========
    {
        id: 'eeprom', label: 'EEPROM', registers: [
            { name: 'EEARH', addr: 0x42 },
            { name: 'EEARL', addr: 0x41 },
            { name: 'EEDR',  addr: 0x40 },
            {
                name: 'EECR', addr: 0x3F, bitFields: [
                    { name: 'EEPM', bits: [5, 4], description: 'EEPROM Programming Mode' },
                    { name: 'EERIE', bits: [3], description: 'EEPROM Ready Interrupt Enable' },
                    { name: 'EEMPE', bits: [2], description: 'EEPROM Master Write Enable' },
                    { name: 'EEPE',  bits: [1], description: 'EEPROM Write Enable' },
                    { name: 'EERE',  bits: [0], description: 'EEPROM Read Enable' },
                ]
            }
        ]
    },

    // ========== Power & Sleep ==========
    {
        id: 'power', label: 'Power & Sleep', registers: [
            {
                name: 'SMCR', addr: 0x53, bitFields: [
                    { name: 'SM', bits: [3, 2, 1], description: 'Sleep Mode Select' },
                    { name: 'SE', bits: [0], description: 'Sleep Enable' },
                ]
            },
            {
                name: 'MCUCR', addr: 0x55, bitFields: [
                    { name: 'BODS',  bits: [6], description: 'BOD Sleep' },
                    { name: 'BODSE', bits: [5], description: 'BOD Sleep Enable' },
                    { name: 'PUD',   bits: [4], description: 'Pull-up Disable' },
                    { name: 'IVSEL', bits: [1], description: 'Interrupt Vector Select' },
                    { name: 'IVCE',  bits: [0], description: 'Interrupt Vector Change Enable' },
                ]
            },
            {
                name: 'MCUSR', addr: 0x54, bitFields: [
                    { name: 'WDRF',  bits: [3], description: 'Watchdog Reset Flag' },
                    { name: 'BORF',  bits: [2], description: 'Brown-out Reset Flag' },
                    { name: 'EXTRF', bits: [1], description: 'External Reset Flag' },
                    { name: 'PORF',  bits: [0], description: 'Power-on Reset Flag' },
                ]
            },
            {
                name: 'PRR', addr: 0x64, bitFields: [
                    { name: 'PRTWI',   bits: [7], description: 'Power Reduction TWI' },
                    { name: 'PRTIM2',  bits: [6], description: 'Power Reduction Timer/Counter2' },
                    { name: 'PRTIM0',  bits: [5], description: 'Power Reduction Timer/Counter0' },
                    { name: 'PRTIM1',  bits: [3], description: 'Power Reduction Timer/Counter1' },
                    { name: 'PRSPI',   bits: [2], description: 'Power Reduction SPI' },
                    { name: 'PRUSART0', bits: [1], description: 'Power Reduction USART0' },
                    { name: 'PRADC',   bits: [0], description: 'Power Reduction ADC' },
                ]
            }
        ]
    },

    // ========== System & Interrupts ==========
    {
        id: 'sys', label: 'System & Interrupts', registers: [
            {
                name: 'EICRA', addr: 0x69, bitFields: [
                    { name: 'ISC1', bits: [3, 2], description: 'Interrupt Sense Control 1' },
                    { name: 'ISC0', bits: [1, 0], description: 'Interrupt Sense Control 0' },
                ]
            },
            {
                name: 'EIMSK', addr: 0x3D, bitFields: [
                    { name: 'INT1', bits: [1], description: 'External Interrupt Request 1 Enable' },
                    { name: 'INT0', bits: [0], description: 'External Interrupt Request 0 Enable' },
                ]
            },
            {
                name: 'EIFR', addr: 0x3C, bitFields: [
                    { name: 'INTF1', bits: [1], description: 'External Interrupt Flag 1' },
                    { name: 'INTF0', bits: [0], description: 'External Interrupt Flag 0' },
                ]
            },
            {
                name: 'PCICR', addr: 0x68, bitFields: [
                    { name: 'PCIE2', bits: [2], description: 'Pin Change Interrupt Enable 2' },
                    { name: 'PCIE1', bits: [1], description: 'Pin Change Interrupt Enable 1' },
                    { name: 'PCIE0', bits: [0], description: 'Pin Change Interrupt Enable 0' },
                ]
            },
            {
                name: 'PCIFR', addr: 0x3B, bitFields: [
                    { name: 'PCIF2', bits: [2], description: 'Pin Change Interrupt Flag 2' },
                    { name: 'PCIF1', bits: [1], description: 'Pin Change Interrupt Flag 1' },
                    { name: 'PCIF0', bits: [0], description: 'Pin Change Interrupt Flag 0' },
                ]
            },
            { name: 'PCMSK0', addr: 0x6B, bitFields: portBits('PCINT', 8) },
            {
                name: 'PCMSK1', addr: 0x6C, bitFields: [
                    { name: 'PCINT14', bits: [6] }, { name: 'PCINT13', bits: [5] },
                    { name: 'PCINT12', bits: [4] }, { name: 'PCINT11', bits: [3] },
                    { name: 'PCINT10', bits: [2] }, { name: 'PCINT9',  bits: [1] },
                    { name: 'PCINT8',  bits: [0] },
                ]
            },
            {
                name: 'PCMSK2', addr: 0x6D, bitFields: [
                    { name: 'PCINT23', bits: [7] }, { name: 'PCINT22', bits: [6] },
                    { name: 'PCINT21', bits: [5] }, { name: 'PCINT20', bits: [4] },
                    { name: 'PCINT19', bits: [3] }, { name: 'PCINT18', bits: [2] },
                    { name: 'PCINT17', bits: [1] }, { name: 'PCINT16', bits: [0] },
                ]
            },
            {
                name: 'WDTCSR', addr: 0x60, bitFields: [
                    { name: 'WDIF', bits: [7], description: 'Watchdog Interrupt Flag' },
                    { name: 'WDIE', bits: [6], description: 'Watchdog Interrupt Enable' },
                    { name: 'WDP[3]', bits: [5], description: 'Watchdog Timer Prescaler (高位)' },
                    { name: 'WDCE', bits: [4], description: 'Watchdog Change Enable' },
                    { name: 'WDE',  bits: [3], description: 'Watchdog System Reset Enable' },
                    { name: 'WDP[2:0]', bits: [2, 1, 0], description: 'Watchdog Timer Prescaler (低位)' },
                ]
            }
        ]
    }
];
