
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
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
  }));
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
