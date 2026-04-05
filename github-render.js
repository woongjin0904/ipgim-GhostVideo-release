const fs = require('fs');
const path = require('path');

// [FIX 1] 실행 환경에 종속되지 않는 범용적인 절대 경로 보장
const outputDir = path.resolve(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

process.env.REMOTION_PUPPETEER_LOG_LEVEL = 'verbose';

async function runGitHubRender() {
    const { renderTwickVideo } = await import('@twick/render-server');

    // Base64 디코딩 시 명시적 utf8 처리
    const decodeBase64 = (str) => {
        if (!str) return "";
        return Buffer.from(str, 'base64').toString('utf8');
    };

    let title = decodeBase64(process.env.POST_TITLE) || "제목 없음";
    let content = decodeBase64(process.env.POST_CONTENT) || "내용 없음";
    
    // [FIX 2] 제어문자 정제 오류 수정: 줄바꿈(\n), 탭(\t)은 살리고 시스템 파괴 문자만 제거
    const safeReplace = (text) => {
        return text
            .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '') // 널바이트 및 특수 제어문자 컷
            .replace(/"/g, "'") // JSON.parse 충돌 방지를 위해 쌍따옴표만 홑따옴표로 안전 치환
            .trim();
    };

    title = safeReplace(title);
    content = safeReplace(content);

    const templateCode = decodeBase64(process.env.TEMPLATE_CODE);
    // [FIX 3] 템플릿 파일 역시 절대 경로로 고정
    const templatePath = path.resolve(__dirname, 'Template.jsx');
    
    const typingSpeedMs = 40;
    const charsPerSecond = 1000 / typingSpeedMs;
    const contentLen = content.length > 0 ? content.length : 1; 
    const durationInSeconds = Math.max((contentLen / charsPerSecond) + 2, 5);
    const dynamicDurationInFrames = Math.max(Math.floor(durationInSeconds * 30), 150);

    process.env.DURATION_IN_FRAMES = dynamicDurationInFrames.toString();
    process.env.VIDEO_DURATION = dynamicDurationInFrames.toString();

    if (templateCode) {
        const finalTemplateCode = templateCode + `\n\nexport const durationInFrames = ${dynamicDurationInFrames};\nexport const fps = 30;\nexport const width = 720;\nexport const height = 1280;\n`;
        fs.writeFileSync(templatePath, finalTemplateCode, 'utf8');
    }

    let inputConfig = {};
    try {
        const decodedConfig = decodeBase64(process.env.POST_CONFIG);
        if (decodedConfig) inputConfig = JSON.parse(decodedConfig);
    } catch (e) {
        console.error("Config Parsing Error:", e);
    }

    try {
        await renderTwickVideo({
            width: 720,
            height: 1280,
            durationInFrames: dynamicDurationInFrames,
            frames: dynamicDurationInFrames,
            fps: 30,
            concurrency: 4,
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
                    durationInFrames: dynamicDurationInFrames,
                    duration: dynamicDurationInFrames,
                    totalDuration: durationInSeconds,
                    fps: 30,
                    ...inputConfig
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
            // [FIX 4] GitHub Actions의 업로드 타겟 경로(output 폴더)와 정확히 일치시킴
            outFile: path.join(outputDir, 'final_shorts.mp4'), 
            quality: "high"
        });

    } catch (error) {
        console.error("Render Error:", error);
        process.exit(1);
    }
}

runGitHubRender();