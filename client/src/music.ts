/** The background music, starts on the first click since browsers block autoplay. */
export const music: HTMLAudioElement = new Audio("/audio.m4a");
music.loop = true;
music.volume = 0.1;

document.addEventListener("click", () => music.play().catch(() => { }), { once: true });
