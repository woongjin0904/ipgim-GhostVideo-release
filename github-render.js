const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer'); 

process.env.REMOTION_PUPPETEER_LOG_LEVEL = 'verbose';

// 💡 720x1280 강제 고정 및 초기화 대기 몽키 패치
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const browser = await originalLaunch.call(puppeteer, {
        ...options,
        headless: "new",
        args: [ 
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--use-gl=swiftshader',
            '--hide-scrollbars',
            '--mute-audio',
            // 💡 창 크기를 실행 시점부터 강제 고정
            '--window-size=720,1280' 
        ]
    });

    // 💡 브라우저가 뜰 때 새 페이지의 Viewport를 무조건 고정시키는 로직 주입
    const originalNewPage = browser.newPage;
    browser.newPage = async function() {
        const page = await originalNewPage.call(this);
        await page.setViewport({ width: 720, height: 1280 });
        return page;
    };

    return browser;
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 렌더링 엔진 가동!");

    const { renderTwickVideo } = await import('@twick/render-server');

    // 환경 변수에서 config 파싱
    let inputConfig = {};
    try {
        inputConfig = JSON.parse(process.env.POST_CONFIG || "{}");
    } catch (e) {
        inputConfig = {};
    }

    const templatePath = path.join(__dirname, 'Template.jsx');

    try {
        await renderTwickVideo({
            input: {
                entry: templatePath, 
                properties: {
                    postTitle: process.env.POST_TITLE, 
                    postContent: (process.env.POST_CONTENT || "").replace(/[ \t]+/g, ' ').trim(), 
                    views: "15,820", 
                    postUp: 940,
                    cardBgColor: inputConfig.cardBgColor || "#1a1a24"
                },
                durationInFrames: 300, 
                fps: 30, 
                // 💡 여기서 width/height가 0이 되지 않도록 강제 보정합니다.
                width: Number(inputConfig.width) || 720, 
                height: Number(inputConfig.height) || 1280
            },
            beforeRender: async (page) => {
                // 💡 브라우저 내부에서 인코더가 작동하기 전 뷰포트를 한 번 더 확실히 잡습니다.
                const w = Number(inputConfig.width) || 720;
                const h = Number(inputConfig.height) || 1280;
                await page.setViewport({ width: w, height: h });
                await new Promise(r => setTimeout(r, 2000)); 
            }
        }, { outFile: 'output/final_shorts.mp4', quality: "high" });

        console.log(`📂 렌더링 완료!`);
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
runGitHubRender();