declare module 'spin-wheel' {
    export interface WheelProps {
        borderColor?: string;
        borderWidth?: number;
        debug?: boolean;
        image?: HTMLImageElement | null;
        isInteractive?: boolean;
        itemBackgroundColors?: string[];
        itemLabelAlign?: 'left' | 'center' | 'right';
        itemLabelBaselineOffset?: number;
        itemLabelColors?: string[];
        itemLabelFont?: string;
        itemLabelFontSizeMax?: number;
        itemLabelRadius?: number;
        itemLabelRadiusMax?: number;
        itemLabelRotation?: number;
        itemLabelStrokeColor?: string;
        itemLabelStrokeWidth?: number;
        items?: ItemProps[];
        lineColor?: string;
        lineWidth?: number;
        offset?: { x: number; y: number };
        onCurrentIndexChange?: (event: any) => void;
        onRest?: (event: any) => void;
        onSpin?: (event: any) => void;
        overlayImage?: HTMLImageElement | null;
        pixelRatio?: number;
        pointerAngle?: number;
        radius?: number;
        rotation?: number;
        rotationResistance?: number;
        rotationSpeedMax?: number;
    }

    export interface ItemProps {
        backgroundColor?: string;
        label?: string;
        labelColor?: string;
    }

    export class Wheel {
        constructor(container: Element, props?: WheelProps);

        add(container: Element): void;
        remove(): void;
        resize(): void;
        draw(now?: number): void;
        spin(rotationSpeed: number): void;
        spinTo(
            rotation: number,
            duration: number,
            easingFunction?: (n: number) => number
        ): void;
        spinToItem(
            itemIndex: number,
            duration: number,
            spinToCenter: boolean,
            numberOfRevolutions: number,
            direction: number,
            easingFunction?: (n: number) => number
        ): void;
        stop(): void;
        dragStart(point: { x: number; y: number }): void;
        dragMove(point: { x: number; y: number }): void;
        dragEnd(): void;
        wheelHitTest(point: { x: number; y: number }): boolean;
        refresh(): void;
        getCurrentIndex(): number;

        // Properties with getters and setters
        borderColor: string;
        borderWidth: number;
        debug: boolean;
        image: HTMLImageElement | null;
        isInteractive: boolean;
        itemBackgroundColors: string[];
        itemLabelAlign: 'left' | 'center' | 'right';
        itemLabelBaselineOffset: number;
        itemLabelColors: string[];
        itemLabelFont: string;
        itemLabelFontSizeMax: number;
        itemLabelRadius: number;
        itemLabelRadiusMax: number;
        itemLabelRotation: number;
        itemLabelStrokeColor: string;
        itemLabelStrokeWidth: number;
        items: ItemProps[];
        lineColor: string;
        lineWidth: number;
        offset: { x: number; y: number };
        onCurrentIndexChange: ((event: any) => void) | null;
        onRest: ((event: any) => void) | null;
        onSpin: ((event: any) => void) | null;
        overlayImage: HTMLImageElement | null;
        pixelRatio: number;
        pointerAngle: number;
        radius: number;
        rotation: number;
        rotationResistance: number;
        rotationSpeedMax: number;
    }
}