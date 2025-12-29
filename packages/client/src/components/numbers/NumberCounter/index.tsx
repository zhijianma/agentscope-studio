import { formatNumber } from '@/utils/common';
import { Flex } from 'antd';
import { CSSProperties, memo } from 'react';
import SlotCounter from 'react-slot-counter';

/**
 * Props for animated number counter.
 * `number` is displayed with thousand separators; optional `style` applies to wrapper.
 */
interface Props {
    number: number | undefined | null;
    style?: CSSProperties;
}

/**
 * Animated numeric display based on react-slot-counter.
 * Starts from 0 once and animates to the given number.
 */
const NumberCounter = ({ number, style = {} }: Props) => {
    // Ensure we have a valid number, default to 0 if undefined/null/NaN
    const validNumber =
        typeof number === 'number' && !isNaN(number) ? number : 0;

    const formattedNumber = formatNumber(validNumber);
    const match = /([0-9.,\s\u00A0]*)([KMBT]?)$/.exec(formattedNumber);
    const numericPart = match ? match[1] : formattedNumber;
    const unitPart = match ? match[2] : '';
    return (
        <Flex style={{ ...style }} align="center">
            <SlotCounter
                startValue={0}
                startValueOnce
                value={numericPart}
                sequentialAnimationMode
            // useMonospaceWidth
            />
            {unitPart && <span>{unitPart}</span>}
        </Flex>
    );
};

export default memo(NumberCounter);
