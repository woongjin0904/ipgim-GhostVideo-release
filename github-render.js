// github-render.js
const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch(e) {
    puppeteer = require('puppeteer');
}

const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const newOptions = {
        ...options,
        // 🔥 [핵심 추가] 모니터가 없는 리눅스 서버에서 화면이 0x0으로 찌그러지는 현상 완벽 방지
        defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
        args: [
            ...(options?.args || []),
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--window-size=1080,1920' // 🔥 브라우저 창 크기도 쇼츠 비율로 강제 고정
        ]
    };
    return originalLaunch.call(puppeteer, newOptions);
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 리눅스 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";
    const configRaw = process.env.POST_CONFIG || "{}";
    const config = JSON.parse(configRaw);

    // [유지] Twick 엔진의 경로 중복 결합 버그 우회용 폴더 생성
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
                    properties: {
                        postTitle: title,
                        postContent: cleanContent,
                        views: "15,820",
                        postUp: 940,
                        cardBgColor: config?.cardBgColor || "#ffd7d7",
                        config: config
                    },
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

        // [유지] 저장된 영상을 찾아 정상 위치로 구출
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