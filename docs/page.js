document.addEventListener('DOMContentLoaded', () => {
    const reveals = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        reveals.forEach(el => {
            const windowHeight = window.innerHeight;
            const elementTop = el.getBoundingClientRect().top;
            const elementVisible = 150;

            if (elementTop < windowHeight - elementVisible) {
                el.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Trigger once on load

    // Smooth movement for mockup based on scroll
    const mockup = document.querySelector('.mockup-frame');
    window.addEventListener('scroll', () => {
        let scroll = window.pageYOffset;
        if (mockup) {
            mockup.style.transform = `rotateX(${Math.max(0, 5 - scroll/100)}deg) translateY(${Math.min(0, scroll/5)}px)`;
        }
    });
});
