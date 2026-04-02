const fs = require('fs');
const path = require('path');

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
                // 1. 기존 방식 유지
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
                },
                // 2. 혹시 몰라 최상단 객체에도 해상도 명시 (버전별 API 스펙 차이 대응)
                width: 1080,
                height: 1920,
                fps: FPS,
                durationInFrames: totalFrames
            },
            {
                outFile: outputVideoPath,
                quality: "high",
                // 3. 옵션 객체에도 해상도 명시
                width: 1080,
                height: 1920,
                // 4. Puppeteer (Chromium) 브라우저 자체의 뷰포트 크기를 1080x1920으로 강제 고정
                chromiumOptions: {
                    defaultViewport: { width: 1080, height: 1920 },
                    args: [
                        '--no-sandbox', 
                        '--disable-setuid-sandbox',
                        '--window-size=1080,1920',  // 윈도우 창 크기 강제 지정
                        '--disable-web-security'
                    ]
                }
            }
        );

        console.log(`✅ 비디오 렌더링 완료! 경로: ${videoPath}`);
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();