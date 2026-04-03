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
    console.log("🚀 GitHub Actions: Twick 렌더링 엔진 (720x1280) 가동!");

    const { renderTwickVideo } = await import('@twick/render-server');

    // ... (환경 변수 파싱 및 파일 저장 로직 동일) ...
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateCode = process.env.TEMPLATE_CODE;
    const templatePath = path.join(__dirname, 'Template.jsx');
    fs.writeFileSync(templatePath, templateCode, 'utf8');

    try {
        await renderTwickVideo({
            input: {
                entry: templatePath, 
                properties: {
                    postTitle: title, 
                    postContent: content.replace(/[ \t]+/g, ' ').trim(), 
                    views: "15,820", 
                    postUp: 940,
                    cardBgColor: "#1a1a24"
                },
                durationInFrames: 300, // 테스트용 고정 프레임 (필요시 계산식 복구)
                fps: 30, 
                width: 720, 
                height: 1280
            },
            // 💡 렌더링 전 브라우저가 레이아웃을 잡을 시간을 벌어줍니다.
            beforeRender: async (page) => {
                console.log("⏳ 레이아웃 안정화 대기 중...");
                await page.setViewport({ width: 720, height: 1280 });
                await new Promise(r => setTimeout(r, 3000)); // 3초 강제 대기
                // 💡 요소 크기가 잡혔는지 체크하는 스크립트 실행 가능
            }
        }, { outFile: 'final_shorts.mp4', quality: "high" });

        // ... (파일 구출 로직 동일) ...
        console.log(`📂 렌더링 완료!`);
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
runGitHubRender();