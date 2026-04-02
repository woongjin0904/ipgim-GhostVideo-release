const fs = require('fs');
const path = require('path');

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 리눅스 렌더링 엔진 가동 시작!");

    // 💡 핵심 해결책: 패키지 버그 우회를 위해 require 대신 동적 import 사용!
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
                    // 💡 루트 경로 기준이므로 __dirname 대신 절대 경로 명시
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
                quality: "high",
                puppeteerOptions: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            }
        );

        console.log(`✅ 완료! 경로: ${videoPath}`);
    } catch (error) {
        console.error(`❌ 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();