import { useEffect, useState } from "react";

/** How long the rainbow stays up, in ms. */
const DURATION = 3000;

/** Full-screen rainbow shown once when the page opens. Requested for SamuelD, with his consent. */
export function PrideFlash() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timeout = setTimeout(() => setVisible(false), DURATION);
        return () => clearTimeout(timeout);
    }, []);

    if (!visible) return null;
    return (
        <div id="prideFlash">
            <span>GAY!</span>
        </div>
    );
}
