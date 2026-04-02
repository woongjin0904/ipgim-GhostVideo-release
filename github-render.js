const fs = require('fs');
const path = require('path');
const { renderTwickVideo } = require('@twick/render-server');

async function runGitHubRender() {

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