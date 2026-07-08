function openMNav(){document.getElementById('mNav').classList.add('open');document.body.style.overflow='hidden'}
function closeMNav(){document.getElementById('mNav').classList.remove('open');document.body.style.overflow=''}
function submitForm(e){
  e.preventDefault();
  document.getElementById('formOk').style.display='block';
  document.getElementById('cForm').reset();
  setTimeout(()=>{document.getElementById('formOk').style.display='none'},6000);
}
// Smooth scroll with header offset
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',function(e){
    const t=document.querySelector(this.getAttribute('href'));
    if(t){e.preventDefault();window.scrollTo({top:t.offsetTop-80,behavior:'smooth'});closeMNav()}
  });
});
// Scroll reveal
const io=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){e.target.style.opacity='1';e.target.style.transform='translateY(0)'}})
},{threshold:0.08});
document.querySelectorAll('.service-tile,.testi-card,.stat-item,.welcome-text,.provider-text,.contact-info,.contact-form-box').forEach(el=>{
  el.style.opacity='0';el.style.transform='translateY(22px)';
  el.style.transition='opacity 0.55s ease,transform 0.55s ease';
  io.observe(el);
});
