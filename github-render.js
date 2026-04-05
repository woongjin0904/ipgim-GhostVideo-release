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
    
    // JSON 파싱 에러 방지용 정제 (그대로 유지)
    title = title.replace(/[\r\n\t]+/g, ' ').replace(/["\\]/g, "'").replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
    content = content.replace(/[\r\n\t]+/g, ' ').replace(/["\\]/g, "'").replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();

    const templateCode = decodeBase64(process.env.TEMPLATE_CODE);
    const templatePath = path.join(process.cwd(), 'Template.jsx');
    
    const typingSpeedMs = 40;
    const charsPerSecond = 1000 / typingSpeedMs;
    const contentLen = content.length > 0 ? content.length : 1; 
    const durationInSeconds = Math.max((contentLen / charsPerSecond) + 2, 5);
    const dynamicDurationInFrames = Math.max(Math.floor(durationInSeconds * 30), 150);

    // 🔥 핵심 해결책: 템플릿 코드 맨 밑에 프레임 수, FPS, 해상도를 강제로 export하여 엔진에 주입
    if (templateCode) {
        const finalTemplateCode = templateCode + `\n\nexport const durationInFrames = ${dynamicDurationInFrames};\nexport const fps = 30;\nexport const width = 720;\nexport const height = 1280;\n`;
        fs.writeFileSync(templatePath, finalTemplateCode, 'utf8');
    }

    let inputConfig = {};
    try {
        const decodedConfig = decodeBase64(process.env.POST_CONFIG);
        if (decodedConfig) inputConfig = JSON.parse(decodedConfig);
    } catch (e) {
    }

    const finalOutputDir = path.join(process.cwd(), 'output');

    try {
        await renderTwickVideo({
            width: 720,
            height: 1280,
            durationInFrames: dynamicDurationInFrames,
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
                    fps: 30
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
                    '--use-gl=swiftshader',
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
                    '--use-gl=swiftshader',
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