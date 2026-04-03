// github-render.js
const fs = require('fs');
const path = require('path');

// 🚫 [핵심 조치] 리눅스 비디오 인코더를 고장내던 윈도우용 몽키 패치(puppeteer.launch 덮어쓰기)를 완전히 삭제했습니다.
// Twick 엔진 내부의 최적화된 Puppeteer 설정이 알아서 작동하도록 맡겨야 합니다.

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 리눅스 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";
    const configRaw = process.env.POST_CONFIG || "{}";
    const config = JSON.parse(configRaw);

    // [유지] FFmpeg 경로 꼬임 버그 방지용 기형적 폴더 선행 생성
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
    // 예상 영상 길이 계산 (글자수에 비례)
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`[${title}] 렌더링 중... (예상 프레임: ${totalFrames})`);

    try {
        await renderTwickVideo(
            {
                input: {
                    entry: path.join(__dirname, 'video', `${templateName}.jsx`),
                    properties: {
                        postTitle: title,
                        postContent: cleanContent,
                        views: "15,820",
                        postUp: 940,
                        cardBgColor: config?.cardBgColor || "#1a1a24",
                        config: config,
                        // 안전을 위해 properties 안쪽에도 사이즈를 명시
                        width: 1080,
                        height: 1920,
                        durationInFrames: totalFrames,
                        fps: FPS
                    },
                    // Twick 엔진이 0초로 강제 종료하지 못하도록 정확한 프레임과 사이즈 명시
                    durationInFrames: totalFrames,
                    fps: FPS,
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

        // [유지] 저장된 0바이트가 아닌 진짜 파일을 찾아 정상 위치로 구출
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