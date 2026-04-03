// github-render.js
const fs = require('fs');
const path = require('path');

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 리눅스 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";
    const configRaw = process.env.POST_CONFIG || "{}";
    const config = JSON.parse(configRaw);

    // 🔥 1. FFmpeg 경로 꼬임 버그(0바이트 파일 원인)를 회피하기 위한 기형적 폴더 선행 생성
    const outputDir = path.join(__dirname, 'output');
    const buggyDir1 = path.join(outputDir, __dirname); 
    const buggyDir2 = path.join(outputDir, __dirname, 'output');
    
    [outputDir, buggyDir1, buggyDir2].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();

    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`[${title}] 렌더링 중... (예상 프레임: ${totalFrames})`);

    try {
        await renderTwickVideo(
            {
                input: {
                    entry: path.join(__dirname, 'video', `${templateName}.jsx`),
                    // 🔥 2. 화면 크기 0x0 에러의 진범 해결:
                    // Twick이 캔버스 크기를 정상적으로 잡을 수 있도록 properties 안에 해상도를 다시 넣어줍니다.
                    properties: {
                        width: 1080,
                        height: 1920,
                        postTitle: title,
                        postContent: cleanContent,
                        views: "15,820",
                        postUp: 940,
                        cardBgColor: config?.cardBgColor || "#ffd7d7",
                        config: config
                    },
                    durationInFrames: totalFrames,
                    fps: FPS,
                    // 혹시 모를 이중 안전장치로 밖에도 명시합니다.
                    width: 1080,
                    height: 1920
                }
            },
            {
                outFile: tempVideoName,
                quality: "high"
            }
        );

        console.log(`✅ 1차 비디오 렌더링(엔진 통과) 성공!`);

        // 🔥 3. 기형적인 폴더 구조 어딘가에 처박힌 완성된 영상을 찾아 정상 위치로 구출
        const finalDest = path.join(__dirname, 'output', 'final_shorts.mp4');
        const possiblePaths = [
            path.join(__dirname, tempVideoName),
            path.join(outputDir, tempVideoName),
            path.join(buggyDir1, tempVideoName),
            path.join(buggyDir2, tempVideoName),
        ];

        let foundPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                foundPath = p;
                break;
            }
        }

        if (foundPath) {
            if (foundPath !== finalDest) {
                fs.renameSync(foundPath, finalDest);
            }
            console.log(`📂 최종 파일 구출 완료! YAML 업로드 준비 끝: ${finalDest}`);
        } else {
            throw new Error("렌더링은 에러 없이 끝났으나 결과 파일을 찾을 수 없습니다.");
        }

    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
 
runGitHubRender();