// Shared app state: current scene, career, modal dialog, toasts.
export const app = {
  scene: null, career: null, modal: null, toastText: '', toastT: 0,
  fadeT: 0,
  go(scene) { this.scene = scene; this.modal = null; this.fadeT = 0.2; scene.enter && scene.enter(); },
  toast(s, t = 2.2) { if (!s) return; this.toastText = s; this.toastT = t; },
  confirm(title, lines, onYes, yes = 'YES') {
    this.modal = { title, lines, buttons: [{ label: yes, fn: onYes, color: '#b13e53' }, { label: 'CANCEL', fn: () => {} }] };
  },
  autosave: null, // set by main
};
