const fs = require('fs');
const path = require('path');

// [범용성 확보] 실행 위치에 상관없이 절대 경로 고정
const rootDir = process.cwd();
const outputDir = path.resolve(rootDir, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

async function runGitHubRender() {
    const { renderTwickVideo } = await import('@twick/render-server');
    const decode = (str) => str ? Buffer.from(str, 'base64').toString('utf8') : "";

    const title = decode(process.env.POST_TITLE);
    const content = decode(process.env.POST_CONTENT);
    const templateCode = decode(process.env.TEMPLATE_CODE);
    const templatePath = path.resolve(rootDir, 'Template.jsx');

    // 1. 프레임 계산 및 환경 변수 고정
    const durationInSeconds = Math.max((content.length / (1000 / 40)) + 2, 5);
    const dynamicFrames = Math.max(Math.floor(durationInSeconds * 30), 150);

    // 2. 템플릿에 길이 변수 강제 주입 (엔진 호환성 정답)
    if (templateCode) {
        const injectedCode = templateCode + `
            export const durationInFrames = ${dynamicFrames};
            export const fps = 30;
            export const width = 720;
            export const height = 1280;
        `;
        fs.writeFileSync(templatePath, injectedCode, 'utf8');
    }

    let inputConfig = {};
    try {
        const rawConfig = decode(process.env.POST_CONFIG);
        if (rawConfig) inputConfig = JSON.parse(rawConfig);
    } catch (e) {}

    try {
        await renderTwickVideo({
            width: 720,
            height: 1280,
            durationInFrames: dynamicFrames,
            fps: 30,
            concurrency: 4,
            input: {
                entry: templatePath,
                width: 720,
                height: 1280,
                durationInFrames: dynamicFrames,
                fps: 30,
                properties: {
                    postTitle: title,
                    postContent: content,
                    cardBgColor: inputConfig.cardBgColor || "#1a1a24",
                    ...inputConfig
                }
            },
            chromiumOptions: {
                headless: "new",
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--use-gl=swiftshader', // GPU 없는 환경 보정
                    '--disable-background-timer-throttling'
                ]
            }
        }, { 
            // [결정적 수정] 복사 에러 방지를 위한 절대 경로 설정
            outFile: path.resolve(outputDir, 'final_shorts.mp4'), 
            quality: "high"
        });
    } catch (error) {
        console.error("Render Error:", error);
        process.exit(1);
    }
}

runGitHubRender();