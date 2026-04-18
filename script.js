gsap.registerPlugin(ScrollTrigger);

// 1. Translation System
const i18n = {
    en: {
        nav_home: "Home", nav_ai: "AI Suite", nav_repo: "Repos", nav_commands: "Cmds",
        nav_render: "Render", nav_themes: "Themes", nav_tech: "System", nav_download: "Download",
        hero_badge: "100% Local Intelligence",
        hero_title: "Advanced Local AI <br><span>Project Manager</span>",
        hero_desc: "Welcome to Gitbot, your ultra-secure AI copilot and version control orchestrator. No cloud, no tracking, just precision.",
        hero_btn: "Get Started Now",
        ai_title: "AI Powerhouse",
        ai_desc: "Fully offline project ideation and debugging powered by local Llama modules.",
        repo_title: "Repository Center",
        repo_desc: "Manage all your local codebases with high-performance indexing and snapshots.",
        cmd_title: "Shortcuts & CLI", cmd_hotkeys: "Hotkeys", cmd_cli: "gbot CLI",
        key_toggle: "Toggle Visibility", key_reload: "Force Reload", key_search: "Smart Search",
        cli_commit: "Quick Snapshot", cli_status: "Diff View", cli_plan: "AI Scaffolding",
        render_title: "Format Expert", render_csv: "CSV Data", render_html: "HTML Live", render_md: "Markdown",
        tech_title: "Architecture", tech_front: "React + Vite", tech_front_d: "Modern, type-safe frontend architecture.",
        tech_back: "Electron Core", tech_back_d: "Hardware accelerated desktop experience.",
        footer_dev: "Developed with precision by **YASSER-27**"
    },
    ar: {
        nav_home: "الرئيسية", nav_ai: "الذكاء", nav_repo: "المستودعات", nav_commands: "الأوامر",
        nav_render: "المعالج", nav_themes: "الثيمات", nav_tech: "النظام", nav_download: "تحميل",
        hero_badge: "ذكاء محلي 100%",
        hero_title: "مدير مشاريع <br><span>بذكاء اصطناعي محلي</span>",
        hero_desc: "مرحباً بك في Gitbot، مساعدك الذكي ومركز التحكم في المستودعات. لا سحابة، لا تتبع، فقط دقة متناهية.",
        hero_btn: "ابدأ الآن",
        ai_title: "قوة الذكاء الاصطناعي",
        ai_desc: "تخطيط وبرمجة أوفلاين بالكامل مدعوم بنماذج Llama المحلية.",
        repo_title: "مركز المستودعات",
        repo_desc: "إدارة كافة قواعد بياناتك البرمجية مع أرشفة ولقطات سريعة.",
        cmd_title: "الأوامر والاختصارات", cmd_hotkeys: "الاختصارات", cmd_cli: "واجهة gbot",
        key_toggle: "تبديل الظهور", key_reload: "إعادة تحميل", key_search: "بحث ذكي",
        cli_commit: "لقطة سريعة", cli_status: "عرض الفروقات", cli_plan: "تأسيس المشروع",
        render_title: "خبير التنسيقات", render_csv: "بيانات CSV", render_html: "بث مباشر HTML", render_md: "مارك داون",
        tech_title: "البنية التقنية", tech_front: "الواجهة", tech_front_d: "هيكلية React + Vite حديثة وآمنة.",
        tech_back: "نواة Electron", tech_back_d: "تجربة سطح مكتب مسرعة برمجياً.",
        footer_dev: "تطوير ودقة بواسطة **YASSER-27**"
    }
};

let currentLang = 'en';

function setLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) el.innerHTML = i18n[lang][key];
    });
}

document.getElementById('langToggle').addEventListener('change', (e) => {
    setLanguage(e.target.checked ? 'ar' : 'en');
});

// 2. Navigation & Background Logic
const blobs = [document.getElementById('blob1'), document.getElementById('blob2'), document.getElementById('blob3')];

function updateGlobalBackground(imgSrc) {
    if (!imgSrc) return;
    const url = `url('${imgSrc}')`;
    blobs.forEach(b => {
        b.style.backgroundImage = url;
        b.style.backgroundSize = 'cover';
    });
}

// Fixed Nav Click Logic
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        const el = document.getElementById(target);
        if (el) {
            window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
        }
    });
});

// Scroll Tracking
const sections = gsap.utils.toArray('.anchor');
sections.forEach(section => {
    ScrollTrigger.create({
        trigger: section,
        start: 'top 30%',
        end: 'bottom 30%',
        onEnter: () => syncNav(section.id),
        onEnterBack: () => syncNav(section.id)
    });

    const bg = section.getAttribute('data-bg');
    if (bg) {
        ScrollTrigger.create({
            trigger: section,
            start: 'top 60%',
            onEnter: () => updateGlobalBackground(bg),
            onEnterBack: () => updateGlobalBackground(bg)
        });
    }
});

function syncNav(id) {
    navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-target') === id);
    });
}

// 3. Image Hover Feedback
document.querySelectorAll('.grid-card, .render-item, .sub-item, .final-settings').forEach(item => {
    item.addEventListener('mouseenter', () => {
        let src = item.getAttribute('data-img');
        if (!src && item.querySelector('img')) src = item.querySelector('img').src;
        if (src) updateGlobalBackground(src);
    });
});

// 4. Reveal Animations
gsap.from('.reveal', {
    scrollTrigger: '.reveal',
    opacity: 0,
    y: 20,
    duration: 1,
    stagger: 0.2
});

// Init
setLanguage('en');
updateGlobalBackground('Pack/Repository.png');
console.log('Restoration Complete. Performance Stable.');
