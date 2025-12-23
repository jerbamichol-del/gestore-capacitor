import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CalculatorInputScreenProps {
  onAmountSubmit: (amount: number) => void;
  onClose: () => void;
  initialAmount?: string;
  title: string;
}

const CalculatorInputScreen = React.forwardRef<HTMLDivElement, CalculatorInputScreenProps>((
  { onAmountSubmit, onClose, initialAmount = '', title },
  ref
) => {
  const [displayValue, setDisplayValue] = useState(initialAmount);
  const [expression, setExpression] = useState('');
  const [lastAction, setLastAction] = useState<'number' | 'operator' | 'equals' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleNumberPress = useCallback((num: string) => {
    setDisplayValue(prev => {
      if (prev === '0' || lastAction === 'equals' || lastAction === 'operator') {
        setLastAction('number');
        return num;
      }
      setLastAction('number');
      return prev + num;
    });
  }, [lastAction]);

  const handleOperatorPress = useCallback((operator: string) => {
    if (displayValue && lastAction !== 'operator') {
      setExpression(prev => {
        const newExpr = prev ? `${prev} ${displayValue} ${operator}` : `${displayValue} ${operator}`;
        return newExpr;
      });
      setLastAction('operator');
    }
  }, [displayValue, lastAction]);

  const calculate = useCallback(() => {
    try {
      if (!expression && !displayValue) return;
      
      const fullExpression = expression ? `${expression} ${displayValue}` : displayValue;
      const result = eval(fullExpression.replace(/×/g, '*').replace(/÷/g, '/'));
      
      setDisplayValue(result.toString());
      setExpression('');
      setLastAction('equals');
    } catch (error) {
      setDisplayValue('Errore');
      setExpression('');
      setLastAction(null);
    }
  }, [expression, displayValue]);

  const handleClear = useCallback(() => {
    setDisplayValue('0');
    setExpression('');
    setLastAction(null);
  }, []);

  const handleBackspace = useCallback(() => {
    setDisplayValue(prev => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  }, []);

  const handleDecimal = useCallback(() => {
    if (!displayValue.includes('.')) {
      setDisplayValue(prev => prev + '.');
      setLastAction('number');
    }
  }, [displayValue]);

  const handleSubmit = useCallback(() => {
    const value = parseFloat(displayValue);
    if (!isNaN(value) && value > 0) {
      onAmountSubmit(value);
    }
  }, [displayValue, onAmountSubmit]);

  const buttons = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+']
  ];

  return (
    <div
      ref={ref}
      className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="w-10" />
      </div>

      {/* Display Area */}
      <div className="flex-shrink-0 p-6 bg-gray-50 dark:bg-gray-800">
        {expression && (
          <div className="text-right text-gray-500 dark:text-gray-400 text-sm mb-2">
            {expression}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          readOnly
          className="w-full text-right text-4xl font-bold bg-transparent border-none focus:outline-none"
        />
      </div>

      {/* Calculator Buttons */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
          <button
            onClick={handleClear}
            className="col-span-2 p-6 rounded-xl bg-red-500 text-white font-semibold text-xl active:scale-95 transition-transform"
          >
            AC
          </button>
          <button
            onClick={handleBackspace}
            className="p-6 rounded-xl bg-gray-300 dark:bg-gray-700 font-semibold text-xl active:scale-95 transition-transform"
          >
            ←
          </button>
          <button
            onClick={() => handleOperatorPress('÷')}
            className="p-6 rounded-xl bg-blue-500 text-white font-semibold text-xl active:scale-95 transition-transform"
          >
            ÷
          </button>

          {buttons.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              {row.map((btn) => {
                if (btn === '=') {
                  return (
                    <button
                      key={btn}
                      onClick={calculate}
                      className="p-6 rounded-xl bg-green-500 text-white font-semibold text-xl active:scale-95 transition-transform"
                    >
                      {btn}
                    </button>
                  );
                }
                if (['+', '-', '×'].includes(btn)) {
                  return (
                    <button
                      key={btn}
                      onClick={() => handleOperatorPress(btn)}
                      className="p-6 rounded-xl bg-blue-500 text-white font-semibold text-xl active:scale-95 transition-transform"
                    >
                      {btn}
                    </button>
                  );
                }
                if (btn === '.') {
                  return (
                    <button
                      key={btn}
                      onClick={handleDecimal}
                      className="p-6 rounded-xl bg-gray-300 dark:bg-gray-700 font-semibold text-xl active:scale-95 transition-transform"
                    >
                      {btn}
                    </button>
                  );
                }
                return (
                  <button
                    key={btn}
                    onClick={() => handleNumberPress(btn)}
                    className="p-6 rounded-xl bg-gray-200 dark:bg-gray-800 font-semibold text-xl active:scale-95 transition-transform"
                  >
                    {btn}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Submit Button - Fixed at bottom with safe area */}
      <div className="flex-shrink-0 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleSubmit}
          disabled={!displayValue || displayValue === '0' || displayValue === 'Errore'}
          className="w-full p-4 rounded-xl bg-blue-600 text-white font-semibold text-lg disabled:bg-gray-300 disabled:text-gray-500 active:scale-95 transition-transform"
        >
          Conferma
        </button>
      </div>
    </div>
  );
});

CalculatorInputScreen.displayName = 'CalculatorInputScreen';

export default CalculatorInputScreen;
