const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

process.env.REMOTION_PUPPETEER_LOG_LEVEL = 'verbose';

async function runGitHubRender() {
    const { renderTwickVideo } = await import('@twick/render-server');

    const decodeBase64 = (str) => {
        if (!str) return "";
        return Buffer.from(str, 'base64').toString('utf8');
    };

    let title = decodeBase64(process.env.POST_TITLE) || "제목 없음";
    let content = decodeBase64(process.env.POST_CONTENT) || "내용 없음";
    
    // 1. JSON 파싱 에러(SyntaxError) 원천 차단: 제어문자 및 쌍따옴표 완전 정제
    title = title.replace(/[\r\n\t]+/g, ' ').replace(/["\\]/g, "'").replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
    content = content.replace(/[\r\n\t]+/g, ' ').replace(/["\\]/g, "'").replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

    const templateCode = decodeBase64(process.env.TEMPLATE_CODE);
    const templatePath = path.join(process.cwd(), 'Template.jsx');
    
    const typingSpeedMs = 40;
    const charsPerSecond = 1000 / typingSpeedMs;
    const contentLen = content.length > 0 ? content.length : 1; 
    const durationInSeconds = Math.max((contentLen / charsPerSecond) + 2, 5);
    const dynamicDurationInFrames = Math.max(Math.floor(durationInSeconds * 30), 150);

    // 2. 엔진이 0프레임으로 오해하지 않도록 환경 변수에 프레임 수 강제 주입
    process.env.DURATION_IN_FRAMES = dynamicDurationInFrames.toString();
    process.env.VIDEO_DURATION = dynamicDurationInFrames.toString();

    if (templateCode) {
        // 3. 템플릿 파일 자체의 맨 밑바닥에도 프레임 수 강제 각인
        const finalTemplateCode = templateCode + `\n\nexport const durationInFrames = ${dynamicDurationInFrames};\nexport const fps = 30;\nexport const width = 720;\nexport const height = 1280;\n`;
        fs.writeFileSync(templatePath, finalTemplateCode, 'utf8');
    }

    let inputConfig = {};
    try {
        const decodedConfig = decodeBase64(process.env.POST_CONFIG);
        if (decodedConfig) inputConfig = JSON.parse(decodedConfig);
    } catch (e) {
    }

    try {
        await renderTwickVideo({
            width: 720,
            height: 1280,
            durationInFrames: dynamicDurationInFrames,
            frames: dynamicDurationInFrames, // 프레임 인식 보조 안전장치
            fps: 30,
            concurrency: 4, // 렌더링 속도 대폭 향상
            timeoutInMilliseconds: 120000,
            input: {
                entry: templatePath,
                width: 720,
                height: 1280,
                durationInFrames: dynamicDurationInFrames,
                fps: 30,
                properties: {
                    postTitle: title,
                    postContent: content,
                    views: "15,820",
                    postUp: 940,
                    cardBgColor: inputConfig.cardBgColor || "#1a1a24",
                    width: 720,
                    height: 1280,
                    // 4. Properties 내부에도 모든 형태의 길이 변수 강제 주입
                    durationInFrames: dynamicDurationInFrames,
                    duration: dynamicDurationInFrames,
                    totalDuration: durationInSeconds,
                    fps: 30,
                    ...inputConfig // 프론트엔드 configData 통째로 주입
                }
            },
            
            chromiumOptions: {
                headless: "new",
                defaultViewport: { width: 720, height: 1280 },
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', 
                    '--window-size=720,1280', 
                    '--force-device-scale-factor=1',
                    '--disable-extensions',
                    '--disable-background-timer-throttling'
                ]
            },
            puppeteerOptions: {
                headless: "new",
                defaultViewport: { width: 720, height: 1280 },
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage', 
                    '--window-size=720,1280', 
                    '--force-device-scale-factor=1',
                    '--disable-extensions',
                    '--disable-background-timer-throttling'
                ]
            }

        }, { 
            outFile: 'final_shorts.mp4', 
            quality: "high"
        });

    } catch (error) {
        console.error("Render Error:", error);
        process.exit(1);
    }
}

runGitHubRender();