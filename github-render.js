const fs = require('fs');
const path = require('path');
const Module = require('module');

// 💡 [궁극의 치트키] Node.js의 모듈 로더(require) 자체를 가로챕니다!
// Twick이 내부적으로 puppeteer-core를 불러올 때, 우리가 만든 해상도 고정 패치를 몰래 주입합니다.
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
    const exported = originalRequire.apply(this, arguments);
    
    // puppeteer-core 모듈이 로드되는 순간 포착!
    if (request === 'puppeteer-core' && exported.launch && !exported.__patched) {
        const originalLaunch = exported.launch;
        exported.launch = async function(options) {
            console.log('💉 [Monkey Patch] 리눅스 뷰포트 1080x1920 강제 주입 성공!');
            const newOptions = {
                ...options,
                // 💡 1. 브라우저 도화지(Viewport) 크기를 무조건 숏츠 비율로 고정!
                defaultViewport: { width: 1080, height: 1920 }, 
                args: [
                    ...(options?.args || []),
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    // 💡 2. 브라우저 창(Window) 크기 자체도 1080x1920으로 강제 고정!
                    '--window-size=1080,1920', 
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--disable-software-rasterizer'
                ]
            };
            return originalLaunch.call(this, newOptions);
        };
        exported.__patched = true; // 중복 패치 방지
    }
    return exported;
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 리눅스 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const configRaw = process.env.POST_CONFIG || "{}";
    const config = JSON.parse(configRaw);

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputVideoPath = path.join(outputDir, 'final_shorts.mp4');
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();

    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`[${title}] 렌더링 중... (예상 프레임: ${totalFrames})`);

    try {
        const videoPath = await renderTwickVideo(
            {
                input: {
                    entry: path.join(__dirname, 'video', 'ShortsTemplate.jsx'),
                    properties: {
                        postTitle: title,
                        postContent: cleanContent,
                        views: "15,820",
                        postUp: 940,
                        cardBgColor: config?.cardBgColor || "#ffd7d7"
                    },
                    durationInFrames: totalFrames,
                    fps: FPS,
                    width: 1080,
                    height: 1920
                }
            },
            {
                outFile: outputVideoPath,
                quality: "high"
            }
        );

        console.log(`✅ 비디오 렌더링 완료! 경로: ${videoPath}`);
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();