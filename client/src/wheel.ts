import { ItemProps, Wheel } from "spin-wheel";
import { artLoaded, lights, overlays } from "./wheel-art";

/** The labels for the wheel sections, in order around the wheel. */
const LABELS: number[] = [1, 8, 5, 12, 7, 2, 13, 4, 11, 6, 9, 3, 10];

const HIGHER_COLOR = "#d9d93d";
const LOWER_COLOR = "#863dd9";

/** How long a spin animation takes. */
export const SPIN_TIME = 7000;

/** Wraps the spin-wheel library with the operations the game needs. */
export class WheelController {
    private wheel: Wheel;
    private lightsInterval: ReturnType<typeof setInterval>;

    constructor(container: Element) {
        this.wheel = new Wheel(container, {
            borderWidth: 5,
            lineWidth: 5,
            itemLabelFontSizeMax: 60,
            isInteractive: false,
            itemLabelAlign: "center",
            itemLabelRotation: 90,
            itemLabelBaselineOffset: -0.2
        });
        this.reset();

        // Redraws once the generated images are decoded, in case they weren't ready yet
        artLoaded.then(() => this.wheel.refresh());

        let currentImage = 0;
        this.lightsInterval = setInterval(() => {
            this.wheel.image = lights[currentImage];
            currentImage = (currentImage + 1) % lights.length;
        }, 400);
    }

    /**
     * Shows the given numbers on the wheel.
     * @param numbers The numbers that haven't been spun yet.
     * @param lastSpin The last number spun this round, used to color higher / lower.
     */
    reset(numbers: number[] = LABELS, lastSpin: number = -1): void {
        this.wheel.items = LABELS.filter((n) => numbers.includes(n)).map((n): ItemProps => ({
            label: n.toString(),
            backgroundColor: lastSpin > 0 && n > lastSpin ? HIGHER_COLOR : LOWER_COLOR
        }));
        this.wheel.overlayImage = overlays[Math.max(lastSpin, 0)];
    }

    /** Spins to a number, then removes it and colors the rest higher / lower. Resolves once done. */
    spin(number: number): Promise<void> {
        const index = this.wheel.items.findIndex((item) => item.label == number.toString());
        if (index == -1) {
            console.error("Number not found on wheel");
            return Promise.resolve();
        }

        this.wheel.spinToItem(index, SPIN_TIME, false, 2, 1, (x: number) => -Math.pow(Math.min(1, Math.max(0, -x + 1)), 3) + 1);

        return new Promise((resolve) => setTimeout(() => {
            const remaining = this.wheel.items.map((item) => Number(item.label)).filter((n) => n != number);
            this.reset(remaining, number);
            resolve();
        }, SPIN_TIME));
    }

    remove(): void {
        clearInterval(this.lightsInterval);
        this.wheel.remove();
    }
}
