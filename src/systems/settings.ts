/** Preferências globais (sem save — vale só para a sessão). */
export const settings = {
  reduceMotion: false,
};

export const isDebug = (): boolean =>
  new URLSearchParams(window.location.search).get('debug') === '1';
