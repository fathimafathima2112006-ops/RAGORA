/* RAGORA login UX */
(() => {
  const button = document.getElementById('googleSignIn');
  if (!button) return;
  button.addEventListener('click', () => {
    button.classList.add('is-loading');
    const label = button.querySelector('.ra-google-label');
    if (label) label.textContent = 'Connecting to Google…';
  });
})();

/* RAGORA FX — lightweight, dependency-free motion layer.
   Only runs on pointer devices that haven't asked for reduced motion,
   and only touches transform/CSS custom properties (GPU-friendly). */
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (reduce || coarse) return;

  var TILT_SELECTOR = '.panel,.metric-card,.settings-card,.ra-login-card';
  var active = null;

  function onMove(e){
    var target = e.target.closest ? e.target.closest(TILT_SELECTOR) : null;
    if (target !== active) {
      if (active) reset(active);
      active = target;
    }
    if (!target) return;
    var r = target.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width;   // 0..1
    var py = (e.clientY - r.top) / r.height;   // 0..1
    var maxDeg = 4.5;
    var ry = (px - 0.5) * maxDeg * 2;
    var rx = -(py - 0.5) * maxDeg * 2;
    target.setAttribute('data-tilt', '');
    target.style.setProperty('--rx', rx.toFixed(2) + 'deg');
    target.style.setProperty('--ry', ry.toFixed(2) + 'deg');
  }

  function reset(el){
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  function onLeave(){
    if (active) reset(active);
    active = null;
  }

  document.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('mouseleave', onLeave, { passive: true });
})();
