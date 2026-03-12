export interface RegisterDef {
    name: string;
    addr: number;
}

export interface RegisterGroup {
    id: string;
    label: string;
    registers: RegisterDef[];
}

export const PERIPHERAL_GROUPS: RegisterGroup[] = [
    {
        id: 'portb', label: 'PORT B', registers: [
            { name: 'PORTB', addr: 0x25 }, { name: 'DDRB', addr: 0x24 }, { name: 'PINB', addr: 0x23 }
        ]
    },
    {
        id: 'portc', label: 'PORT C', registers: [
            { name: 'PORTC', addr: 0x28 }, { name: 'DDRC', addr: 0x27 }, { name: 'PINC', addr: 0x26 }
        ]
    },
    {
        id: 'portd', label: 'PORT D', registers: [
            { name: 'PORTD', addr: 0x2B }, { name: 'DDRD', addr: 0x2A }, { name: 'PIND', addr: 0x29 }
        ]
    },
    {
        id: 'timer0', label: 'Timer/Counter 0', registers: [
            { name: 'TCCR0A', addr: 0x44 }, { name: 'TCCR0B', addr: 0x45 },
            { name: 'TCNT0',  addr: 0x46 }, { name: 'OCR0A',  addr: 0x47 },
            { name: 'OCR0B',  addr: 0x48 }, { name: 'TIMSK0', addr: 0x6E },
            { name: 'TIFR0',  addr: 0x35 }
        ]
    },
    {
        id: 'timer1', label: 'Timer/Counter 1', registers: [
            { name: 'TCCR1A', addr: 0x80 }, { name: 'TCCR1B', addr: 0x81 }, { name: 'TCCR1C', addr: 0x82 },
            { name: 'TCNT1H', addr: 0x85 }, { name: 'TCNT1L', addr: 0x84 },
            { name: 'OCR1AH', addr: 0x89 }, { name: 'OCR1AL', addr: 0x88 },
            { name: 'OCR1BH', addr: 0x8B }, { name: 'OCR1BL', addr: 0x8A },
            { name: 'ICR1H',  addr: 0x87 }, { name: 'ICR1L',  addr: 0x86 },
            { name: 'TIMSK1', addr: 0x6F }, { name: 'TIFR1',  addr: 0x36 }
        ]
    },
    {
        id: 'timer2', label: 'Timer/Counter 2', registers: [
            { name: 'TCCR2A', addr: 0xB0 }, { name: 'TCCR2B', addr: 0xB1 },
            { name: 'TCNT2',  addr: 0xB2 }, { name: 'OCR2A',  addr: 0xB3 },
            { name: 'OCR2B',  addr: 0xB4 }, { name: 'TIMSK2', addr: 0x70 },
            { name: 'TIFR2',  addr: 0x37 }, { name: 'ASSR',   addr: 0xB6 }
        ]
    },
    {
        id: 'usart0', label: 'USART 0', registers: [
            { name: 'UDR0',   addr: 0xC6 }, { name: 'UCSR0A', addr: 0xC0 },
            { name: 'UCSR0B', addr: 0xC1 }, { name: 'UCSR0C', addr: 0xC2 },
            { name: 'UBRR0H', addr: 0xC5 }, { name: 'UBRR0L', addr: 0xC4 }
        ]
    },
    {
        id: 'adc', label: 'ADC', registers: [
            { name: 'ADMUX',  addr: 0x7C }, { name: 'ADCSRA', addr: 0x7A },
            { name: 'ADCSRB', addr: 0x7B }, { name: 'ADCH',   addr: 0x79 },
            { name: 'ADCL',   addr: 0x78 }, { name: 'DIDR0',  addr: 0x7E }
        ]
    },
    {
        id: 'spi', label: 'SPI', registers: [
            { name: 'SPCR', addr: 0x4C }, { name: 'SPSR', addr: 0x4D }, { name: 'SPDR', addr: 0x4E }
        ]
    },
    {
        id: 'twi', label: 'TWI (I2C)', registers: [
            { name: 'TWBR',  addr: 0xB8 }, { name: 'TWSR',  addr: 0xB9 },
            { name: 'TWAR',  addr: 0xBA }, { name: 'TWDR',  addr: 0xBB },
            { name: 'TWCR',  addr: 0xBC }, { name: 'TWAMR', addr: 0xBD }
        ]
    },
    {
        id: 'eeprom', label: 'EEPROM', registers: [
            { name: 'EEARH', addr: 0x42 }, { name: 'EEARL', addr: 0x41 },
            { name: 'EEDR',  addr: 0x40 }, { name: 'EECR',  addr: 0x3F }
        ]
    },
    {
        id: 'power', label: 'Power & Sleep', registers: [
            { name: 'SMCR',  addr: 0x53 }, { name: 'MCUCR', addr: 0x55 },
            { name: 'MCUSR', addr: 0x54 }, { name: 'PRR',   addr: 0x64 }
        ]
    },
    {
        id: 'sys', label: 'System & Interrupts', registers: [
            { name: 'EICRA',  addr: 0x69 }, { name: 'EIMSK',  addr: 0x3D },
            { name: 'EIFR',   addr: 0x3C }, { name: 'PCICR',  addr: 0x68 },
            { name: 'PCIFR',  addr: 0x3B }, { name: 'PCMSK0', addr: 0x6B },
            { name: 'PCMSK1', addr: 0x6C }, { name: 'PCMSK2', addr: 0x6D },
            { name: 'WDTCSR', addr: 0x60 }
        ]
    }
];
