// Images drawn on the spin wheel, generated as SVGs so they don't depend on an image host.
// Both are 100x100 and centered on the wheel. The overlay fills the wheel's container (the
// wheel itself is 95% of it) and doesn't rotate; the lights fill the wheel and rotate with it.

const NAVY = "#0e1131";
const GOLD = "#d9d93d";
const BLUE = "#4266c9";

/** Number of light bulbs around the rim. */
const BULBS = 26;
/** Number of frames in the light chase animation. */
export const LIGHT_FRAMES = 3;

function toImage(svg: string): HTMLImageElement {
    const image = new Image();
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    return image;
}

/**
 * The pointer and center hub.
 * @param number The last number spun, shown in the hub. Nothing is shown for 0.
 */
function overlaySvg(number: number): string {
    const label = number > 0
        ? `<text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="${number >= 10 ? 13 : 15}" fill="white">${number}</text>`
        : `<circle cx="50" cy="50" r="3" fill="${GOLD}"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <defs>
            <radialGradient id="hub" cx="40%" cy="35%" r="70%">
                <stop offset="0%" stop-color="${BLUE}"/>
                <stop offset="100%" stop-color="${NAVY}"/>
            </radialGradient>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0.8" stdDeviation="0.8" flood-color="black" flood-opacity="0.6"/>
            </filter>
        </defs>
        <g filter="url(#shadow)">
            <path d="M42 1 L58 1 L50 13 Z" fill="${GOLD}" stroke="${NAVY}" stroke-width="1.2" stroke-linejoin="round"/>
            <circle cx="50" cy="50" r="12" fill="url(#hub)" stroke="${GOLD}" stroke-width="2"/>
        </g>
        ${label}
    </svg>`;
}

/** The ring of bulbs, with every `LIGHT_FRAMES`th bulb lit starting at `frame`. */
function lightsSvg(frame: number): string {
    let bulbs = "";
    for (let i = 0; i < BULBS; i++) {
        const angle = (i / BULBS) * Math.PI * 2;
        const x = (50 + Math.sin(angle) * 47.5).toFixed(2);
        const y = (50 - Math.cos(angle) * 47.5).toFixed(2);
        bulbs += i % LIGHT_FRAMES == frame
            ? `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff36b" opacity="0.45"/><circle cx="${x}" cy="${y}" r="1.5" fill="#fffde0"/>`
            : `<circle cx="${x}" cy="${y}" r="1.3" fill="#8a7f22"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bulbs}</svg>`;
}

/** Overlays indexed by the last number spun (0 for none). */
export const overlays: HTMLImageElement[] = Array.from({ length: 14 }, (_, n) => toImage(overlaySvg(n)));

/** Frames of the flashing lights. */
export const lights: HTMLImageElement[] = Array.from({ length: LIGHT_FRAMES }, (_, f) => toImage(lightsSvg(f)));

/** Resolves once every image is ready to draw. */
export const artLoaded: Promise<unknown> = Promise.all([...overlays, ...lights].map((image) => image.decode().catch(() => { })));
