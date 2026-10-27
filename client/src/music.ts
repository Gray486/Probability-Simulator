/** Volume of the background music when it's on (0 to 1). */
export const MUSIC_VOLUME = 1;

/** The background music, starts on the first click since browsers block autoplay. */
export const music: HTMLAudioElement = new Audio("/audio.m4a");
music.loop = true;
music.volume = MUSIC_VOLUME;

document.addEventListener("click", () => music.play().catch(() => { }), { once: true });
