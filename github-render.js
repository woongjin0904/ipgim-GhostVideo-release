const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer'); 

// 0. 출력 디렉토리 강제 생성 (경로 누락 에러 방지)
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

process.env.REMOTION_PUPPETEER_LOG_LEVEL = 'verbose';

/**
 * 💡 [핵심 수정] Puppeteer 강제 주입 몽키 패치
 * 라이브러리가 내부적으로 브라우저를 띄울 때 무조건 720x1280을 사용하게 만듭니다.
 */
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    console.log("💉 [Patch] 브라우저 사이즈를 720x1280으로 강제 고정하여 런칭합니다.");
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
            // 창 크기를 실행 시점부터 리터럴로 강제 고정
            '--window-size=720,1280',
            '--force-device-scale-factor=1'
        ]
    });

    // 새 페이지가 생성될 때 Viewport가 0이 되는 것을 방지
    const originalNewPage = browser.newPage;
    browser.newPage = async function() {
        const page = await originalNewPage.call(this);
        await page.setViewport({ width: 720, height: 1280 });
        return page;
    };

    return browser;
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 렌더링 엔진 (720x1280 강제 모드) 가동!");

    // 몽키 패치 이후에 라이브러리 로드
    const { renderTwickVideo } = await import('@twick/render-server');

    // 1. 환경 변수 안전하게 읽기
    const title = process.env.POST_TITLE || "제목 없음";
    const content = (process.env.POST_CONTENT || "").replace(/[ \t]+/g, ' ').trim();
    const templateCode = process.env.TEMPLATE_CODE;
    
    // 2. 템플릿 파일 저장
    const templatePath = path.join(__dirname, 'Template.jsx');
    fs.writeFileSync(templatePath, templateCode, 'utf8');

    // 3. POST_CONFIG 파싱 (실패해도 렌더링 수치는 영향 받지 않음)
    let inputConfig = {};
    try {
        if (process.env.POST_CONFIG) {
            inputConfig = JSON.parse(process.env.POST_CONFIG);
        }
    } catch (e) {
        console.warn("⚠️ POST_CONFIG 파싱 실패, 기본 UI 설정을 사용합니다.");
    }

    try {
        await renderTwickVideo({
            input: {
                entry: templatePath, 
                properties: {
                    postTitle: title, 
                    postContent: content, 
                    views: "15,820", 
                    postUp: 940,
                    cardBgColor: inputConfig.cardBgColor || "#1a1a24"
                },
                durationInFrames: 300, 
                fps: 30, 
                // 💡 변수(inputConfig)를 쓰지 않고 숫자 리터럴로 박아서 VideoEncoder 에러 원천 차단
                width: 720, 
                height: 1280
            },
            // 렌더링 직전 최종 레이아웃 확인
            beforeRender: async (page) => {
                console.log("⏳ 렌더링 전 최종 레이아웃 안정화 (720x1280)...");
                await page.setViewport({ width: 720, height: 1280 });
                // 레이아웃이 0에서 숫자로 변하는 시간을 벌어줌
                await new Promise(r => setTimeout(r, 3000)); 
            }
        }, { 
            outFile: path.join(outputDir, 'final_shorts.mp4'), 
            quality: "high" 
        });

        console.log(`📂 렌더링 완료! 결과물 위치: ${path.join(outputDir, 'final_shorts.mp4')}`);
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        // VideoEncoder 에러 발생 시 상세 로그 출력을 위해 프로세스 종료 전 에러 객체 출력
        process.exit(1);
    }
}

runGitHubRender();