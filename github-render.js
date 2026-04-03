const fs = require('fs');
const path = require('path');

// 1. 출력 폴더 보장 (경로 에러 방지)
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

process.env.REMOTION_PUPPETEER_LOG_LEVEL = 'verbose';

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 렌더링 엔진 (Defensive Mode) 가동!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = (process.env.POST_CONTENT || "").replace(/[ \t]+/g, ' ').trim();
    const templateCode = process.env.TEMPLATE_CODE;
    
    // 2. 템플릿 파일 생성
    const templatePath = path.join(__dirname, 'Template.jsx');
    if (templateCode) {
        fs.writeFileSync(templatePath, templateCode, 'utf8');
    }

    // 3. 환경 변수 파싱 (옵션)
    let inputConfig = {};
    try {
        if (process.env.POST_CONFIG) inputConfig = JSON.parse(process.env.POST_CONFIG);
    } catch (e) {
        console.warn("⚠️ POST_CONFIG 파싱 실패, 기본 UI 설정을 사용합니다.");
    }

    try {
        await renderTwickVideo({
            // 💡 방어 전략 1: Root 레벨에 해상도 강제 주입
            width: 720,
            height: 1280,
            durationInFrames: 300,
            fps: 30,
            
            input: {
                entry: templatePath,
                // 💡 방어 전략 2: Input 레벨에 해상도 강제 주입 (Twick 주입 지점)
                width: 720,
                height: 1280,
                durationInFrames: 300,
                fps: 30,
                properties: {
                    postTitle: title,
                    postContent: content,
                    views: "15,820",
                    postUp: 940,
                    cardBgColor: inputConfig.cardBgColor || "#1a1a24",
                    // 💡 방어 전략 3: Properties 컴포넌트 내부 프롭스용 주입
                    width: 720,
                    height: 1280
                }
            },
            
            // 💡 방어 전략 4: Remotion 내부 Puppeteer 엔진에 다이렉트로 args 쏘기
            chromiumOptions: {
                headless: "new",
                defaultViewport: { width: 720, height: 1280 },
                args: [
                    '--no-sandbox', 
                    '--disable-dev-shm-usage', 
                    '--window-size=720,1280', 
                    '--force-device-scale-factor=1'
                ]
            },
            // (Twick 버전에 따라 네이밍이 다를 수 있어 puppeteerOptions도 함께 명시)
            puppeteerOptions: {
                headless: "new",
                defaultViewport: { width: 720, height: 1280 },
                args: [
                    '--no-sandbox', 
                    '--disable-dev-shm-usage', 
                    '--window-size=720,1280', 
                    '--force-device-scale-factor=1'
                ]
            }

        }, { 
            outFile: 'final_shorts.mp4', 
            quality: "high"
        });

        console.log(`📂 렌더링 완료! 결과물 위치: ${path.join(outputDir, 'final_shorts.mp4')}`);
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();