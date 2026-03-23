import React, { useState, useEffect } from 'react';

// Debounced Input prevents IME composition bugs and cursor jumping 
// by updating the global state only when the user finishes typing (on blur).
interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string;
    onChange: (val: string) => void;
}

export const DebouncedTextInput: React.FC<FormInputProps> = ({ value, onChange, ...props }) => {
    const [localValue, setLocalValue] = useState(value || '');

    // Sync external changes
    useEffect(() => {
        if (value !== localValue) {
            setLocalValue(value || '');
        }
    }, [value]);

    return (
        <input
            {...props}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
                if (localValue !== value) {
                    onChange(localValue);
                }
            }}
        />
    );
};

export const DebouncedNumberInput: React.FC<FormInputProps> = ({ value, onChange, ...props }) => {
    const [localValue, setLocalValue] = useState(value || '');

    // Sync external changes
    useEffect(() => {
        if (value !== localValue) {
            setLocalValue(value || '');
        }
    }, [value]);

    return (
        <input
            {...props}
            value={localValue}
            onChange={(e) => {
                // Strip non-numeric and format with commas
                const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                const formattedValue = rawValue ? parseInt(rawValue, 10).toLocaleString('en-US') : '';
                setLocalValue(formattedValue);
            }}
            onBlur={() => {
                if (localValue !== value) {
                    onChange(localValue);
                }
            }}
        />
    );
};
