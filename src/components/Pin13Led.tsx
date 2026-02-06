import React, { useEffect, useState } from 'react';
import { AVRIOPort } from 'avr8js';

interface Pin13LedProps {
    portB: AVRIOPort | undefined;
}

export const Pin13Led: React.FC<Pin13LedProps> = ({ portB }) => {
    const [isOn, setIsOn] = useState(false);

    useEffect(() => {
        if (!portB) return;

        const interval = setInterval(() => {
            // Pin 13 is PB5 on Atmega328P
            const pinState = portB.pinState(5);
            setIsOn(pinState === 1);
        }, 50);

        return () => clearInterval(interval);
    }, [portB]);

    return (
        <div className="led-container">
            <div className={`led-label`}>L (Pin 13)</div>
            <div className={`led ${isOn ? 'on' : 'off'}`} />
        </div>
    );
};
