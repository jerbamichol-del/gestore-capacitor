import React from 'react';
import { BackspaceIcon } from '../icons/BackspaceIcon';
import { FingerprintIcon } from '../icons/FingerprintIcon';

interface PinInputProps {
  pin: string;
  onPinChange: (newPin: string) => void;
  pinLength?: number;
  onBiometric?: () => void;
  showBiometric?: boolean;
}

const PinInput: React.FC<PinInputProps> = ({ pin, onPinChange, pinLength = 4, onBiometric, showBiometric }) => {
  const handleNumberClick = (num: string) => {
    if (pin.length < pinLength) {
      onPinChange(pin + num);
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      onPinChange(pin.slice(0, -1));
    }
  };

  const PinDots = () => (
    <div className="flex justify-center space-x-4 mb-6">
      {Array.from({ length: pinLength }).map((_, index) => (
        <div
          key={index}
          className={`w-4 h-4 rounded-full border-2 transition-colors duration-200 ${index < pin.length ? 'bg-sunset-coral border-sunset-coral dark:bg-electric-violet dark:border-electric-violet' : 'bg-sunset-cream border-slate-300 dark:bg-midnight-card dark:border-electric-violet/30'
            }`}
        />
      ))}
    </div>
  );

  const NumberPad = () => {
    const buttons = [
      '1', '2', '3',
      '4', '5', '6',
      '7', '8', '9',
      'biometric', '0', 'backspace'
    ];

    return (
      <div className="grid grid-cols-3 gap-4">
        {buttons.map((btn, index) => {
          if (btn === 'biometric') {
            if (showBiometric && onBiometric) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={onBiometric}
                  className="w-16 h-16 mx-auto rounded-full text-white btn-electric active:opacity-90 transition-all flex justify-center items-center shadow-lg focus:outline-none focus:ring-2 focus:ring-sunset-coral focus:ring-offset-2"
                  aria-label="Usa impronta digitale"
                >
                  <FingerprintIcon className="w-8 h-8" />
                </button>
              );
            }
            return <div key={index} />;
          }

          if (btn === 'backspace') {
            return (
              <button
                key={index}
                type="button"
                onClick={handleBackspace}
                className="w-16 h-16 mx-auto rounded-full text-sunset-text dark:text-white bg-sunset-cream/50 dark:bg-midnight-card hover:bg-sunset-peach/30 dark:hover:bg-midnight-card/80 transition-colors flex justify-center items-center text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-sunset-coral border-2 border-sunset-coral/20 dark:border-electric-violet/30"
                aria-label="Cancella"
              >
                <BackspaceIcon className="w-7 h-7" />
              </button>
            );
          }
          return (
            <button
              key={index}
              type="button"
              onClick={() => handleNumberClick(btn)}
              className="w-16 h-16 mx-auto rounded-full text-sunset-text dark:text-white bg-sunset-cream/50 dark:bg-midnight-card hover:bg-sunset-peach/30 dark:hover:bg-midnight-card/80 transition-colors text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-sunset-coral border-2 border-sunset-coral/20 dark:border-electric-violet/30"
            >
              {btn}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <PinDots />
      <NumberPad />
    </div>
  );
};

export default PinInput;
