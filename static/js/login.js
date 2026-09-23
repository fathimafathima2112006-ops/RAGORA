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
