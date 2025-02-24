import { Wheel, WheelProps } from "spin-wheel";

/** The properties for the wheel, this creates the labels for the wheel sections. */
const props: WheelProps = {
    items: [
        { label: '1', },
        { label: '8', },
        { label: '5', },
        { label: '12', },
        { label: '7', },
        { label: '2', },
        { label: '13', },
        { label: '4', },
        { label: '11', },
        { label: '6', },
        { label: '9', },
        { label: '3' },
        { label: '10' }
    ]
}

/** The overlay images for the spin wheel */
export const overlays: HTMLImageElement[] = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image()]
overlays[0].src = "https://i.ibb.co/HVWxZgh/Overlay.png";
overlays[1].src = "https://i.ibb.co/RPcCrgk/Overlay-1.png";
overlays[2].src = "https://i.ibb.co/ggCKYxT/Overlay-2.png";
overlays[3].src = "https://i.ibb.co/vLRczqN/Overlay-3.png";
overlays[4].src = "https://i.ibb.co/VLPWFjg/Overlay-4.png";
overlays[5].src = "https://i.ibb.co/FBvSRLD/Overlay-5.png";
overlays[6].src = "https://i.ibb.co/YbCT0g1/Overlay-6.png";
overlays[7].src = "https://i.ibb.co/RY0Q2PH/Overlay-7.png";
overlays[8].src = "https://i.ibb.co/J2w3Q4m/Overlay-8.png";
overlays[9].src = "https://i.ibb.co/RBFqyTr/Overlay-9.png";
overlays[10].src = "https://i.ibb.co/7pGR2Jf/Overlay-10.png";
overlays[11].src = "https://i.ibb.co/XLgxKgr/Overlay-11.png";
overlays[12].src = "https://i.ibb.co/Vt6x01r/Overlay-12.png";
overlays[13].src = "https://i.ibb.co/BV2DvGf/Overlay-13.png";

/** The images for the spin wheel */
const images: HTMLImageElement[] = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image()]
images[0].src = "https://i.ibb.co/7CjQrHJ/Lights-8.png";
images[1].src = "https://i.ibb.co/G2Xts03/Lights-7.png";
images[2].src = "https://i.ibb.co/RHzMpks/Lights-6.png";
images[3].src = "https://i.ibb.co/qYyf7hN/Lights-5.png";
images[4].src = "https://i.ibb.co/0yJ8hFJ/Lights-4.png";
images[5].src = "https://i.ibb.co/X87CF26/Lights-3.png";
images[6].src = "https://i.ibb.co/gFy4s26/Lights-2.png";
images[7].src = "https://i.ibb.co/LYh5CN7/Lights-1.png";
images[8].src = "https://i.ibb.co/Qbjdyx9/Lights.png";

const container: Element | null = document.querySelector('#wheel');

export let wheel: Wheel | null;
generateWheel()

/** The current index of {@link images} that is being displayed. */
let currentImage: number = 0;

setInterval(function () {
    if (!wheel) return;
    wheel.image = images[currentImage]
    currentImage++
    if (currentImage == images.length) {
        currentImage = 0
    }
}, 1000)

/** Generates the spin wheel */
function generateWheel() {
    //@ts-ignore
    wheel = new spinWheel.Wheel(container, props);

    if (!wheel) return;

    for (let i: number = 0; i < 12; i++) {
        wheel.itemBackgroundColors[i] = "#863dd9"
    }

    wheel.overlayImage = overlays[0];
    wheel.borderWidth = 5;
    wheel.lineWidth = 5;
    wheel.itemLabelFontSizeMax = 60;
    wheel.isInteractive = false;
    wheel.itemLabelAlign = 'center';
    wheel.itemLabelRotation = 90;
    wheel.itemLabelBaselineOffset = -0.2;
}