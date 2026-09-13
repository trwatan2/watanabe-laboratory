
// Optional research videos: a missing MP4 leaves the designed placeholder visible.
document.querySelectorAll('video[data-src]').forEach(async video => {
  const src = video.dataset.src;
  try {
    const response = await fetch(src, {method:'HEAD'});
    if(response.ok){
      video.src = src;
      video.load();
      video.play().catch(() => {});
    }
  } catch(e) { /* keep placeholder */ }
});
const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.global-nav');

function updateHeader(){
  if(!header) return;
  header.classList.toggle('scrolled', window.scrollY > 24 || document.body.classList.contains('subpage'));
}
updateHeader();
window.addEventListener('scroll', updateHeader, {passive:true});

if(menuButton && nav){
  const languageMenu = nav.querySelector('.language-menu');
  const desktopLanguagePosition = languageMenu?.nextSibling;
  const closeMenu = () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    if(languageMenu) languageMenu.open = false;
  };
  // Keep keyboard order consistent with the mobile menu's visual order.
  const positionLanguageMenu = () => {
    if(!languageMenu) return;
    if(getComputedStyle(menuButton).display !== 'none'){
      if(nav.firstElementChild !== languageMenu) nav.prepend(languageMenu);
    } else {
      nav.insertBefore(languageMenu, desktopLanguagePosition);
      closeMenu();
    }
  };
  positionLanguageMenu();
  window.addEventListener('resize', positionLanguageMenu, {passive:true});
  menuButton.addEventListener('click', () => {
    if(nav.classList.contains('open')){
      closeMenu();
    } else {
      nav.classList.add('open');
      menuButton.setAttribute('aria-expanded', 'true');
      nav.scrollTop = 0;
    }
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if(event.key === 'Escape' && nav.classList.contains('open')){
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener('click', event => {
    if(!header.contains(event.target)) closeMenu();
  });
}

document.querySelectorAll('video').forEach(video => {
  const placeholder = video.parentElement?.querySelector('.video-placeholder');
  const onReady = () => { if(placeholder) placeholder.style.display = 'none'; };
  video.addEventListener('loadeddata', onReady);
  if(video.readyState >= 2) onReady();
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const year = document.getElementById('year');
if(year) year.textContent = new Date().getFullYear();
