// Fallback for ads that still play, plus removal of the anti-adblock dialog if it appears.
(() => {
  const SKIP = '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern';
  let saved = null; // { muted, rate } from before we touched the video

  const report = () => { try { chrome.runtime.sendMessage({ type: 'yt' }); } catch { /* extension reloaded */ } };
  document.addEventListener('quiet:yt', report);

  const tick = () => {
    const player = document.querySelector('.html5-video-player');
    const video = player?.querySelector('video');

    // Anti-adblock dialog: remove it and resume. Element name may change - verify in DevTools.
    const nag = document.querySelector('ytd-enforcement-message-view-model');
    if (nag) {
      nag.closest('tp-yt-paper-dialog')?.remove();
      document.querySelector('tp-yt-iron-overlay-backdrop')?.remove();
      if (video?.paused) video.play().catch(() => {});
    }

    if (!video) return;
    if (player.classList.contains('ad-showing')) {
      if (!saved) { saved = { muted: video.muted, rate: video.playbackRate }; report(); }
      video.muted = true;
      video.playbackRate = 16;
      if (Number.isFinite(video.duration)) video.currentTime = video.duration;
      document.querySelector(SKIP)?.click();
    } else if (saved) {
      video.muted = saved.muted;
      video.playbackRate = saved.rate;
      saved = null;
    }
  };

  setInterval(tick, 300);
})();
