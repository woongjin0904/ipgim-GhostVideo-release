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

    const title = decodeBase64(process.env.POST_TITLE) || "제목 없음";
    const content = decodeBase64(process.env.POST_CONTENT).replace(/[ \t]+/g, ' ').trim() || "내용 없음";
    const templateCode = decodeBase64(process.env.TEMPLATE_CODE);
    
    const isHtml = templateCode && templateCode.trim().startsWith('<');
    const templateExt = isHtml ? '.html' : '.jsx';
    const templatePath = path.join(process.cwd(), `Template${templateExt}`);
    
    if (templateCode) {
        fs.writeFileSync(templatePath, templateCode, 'utf8');
    }

    let inputConfig = {};
    try {
        const decodedConfig = decodeBase64(process.env.POST_CONFIG);
        if (decodedConfig) inputConfig = JSON.parse(decodedConfig);
    } catch (e) {
    }

    const typingSpeedMs = 40;
    const charsPerSecond = 1000 / typingSpeedMs;
    const contentLen = content.length > 0 ? content.length : 1; 
    const durationInSeconds = Math.max((contentLen / charsPerSecond) + 2, 5);
    const dynamicDurationInFrames = Math.ceil(durationInSeconds * 30);
    
    const finalOutputDir = path.join(process.cwd(), 'output');
try {
        await renderTwickVideo({
            width: 720,
            height: 1280,
            durationInFrames: dynamicDurationInFrames,
            fps: 30,
            concurrency: 4, // GitHub Actions CPU 코어 수에 맞춰 병렬 렌더링 (속도 3~4배 증가)
            timeoutInMilliseconds: 120000, // 2분 내에 렌더링 시작 안 하면 무한대기 끊기
            
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
                    height: 1280
                }
            },
            
            chromiumOptions: {
                headless: "new",
                defaultViewport: { width: 720, height: 1280 },
                args: [
                    '--no-sandbox', 
                    '--disable-dev-shm-usage', 
                    '--window-size=720,1280', 
                    '--force-device-scale-factor=1',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions', // 불필요한 크롬 기능 꺼서 메모리 확보
                    '--disable-background-timer-throttling'
                ]
            },
            puppeteerOptions: {
                headless: "new",
                defaultViewport: { width: 720, height: 1280 },
                args: [
                    '--no-sandbox', 
                    '--disable-dev-shm-usage', 
                    '--window-size=720,1280', 
                    '--force-device-scale-factor=1',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--disable-background-timer-throttling'
                ]
            }

        }, { 
            outFile: 'final_shorts.mp4', 
            quality: "medium" // 속도를 더 원하면 "medium"으로 타협 가능
        });

    } catch (error) {
        console.error("Render Error:", error);
        process.exit(1);
    }
}

runGitHubRender();