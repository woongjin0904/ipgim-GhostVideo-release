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
                input: {
                    entry: path.join(__dirname, 'video', 'ShortsTemplate.jsx'),
                    // 💡 [핵심 해결책] Twick 공식 스펙에 맞게 properties 내부에 해상도 명시!
                    properties: {
                        width: 1080,   // 👈 여기가 0x0 에러의 진짜 원인이었습니다.
                        height: 1920,  // 👈 
                        postTitle: title,
                        postContent: cleanContent,
                        views: "15,820",
                        postUp: 940,
                        cardBgColor: config?.cardBgColor || "#ffd7d7"
                    },
                    durationInFrames: totalFrames,
                    fps: FPS
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