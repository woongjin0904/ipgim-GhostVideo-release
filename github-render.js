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
        args: [
            ...(options?.args || []),
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-dev-shm-usage',
            '--disable-web-security'
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

    // 🔥 [핵심 우회 로직] Twick 엔진의 멍청한 "경로 중복 결합 버그"를 막기 위해
    // 엔진이 멋대로 만들어내는 기형적인 폴더 구조를 렌더링 전에 아예 다 만들어버립니다.
    const outputDir = path.join(__dirname, 'output');
    const buggyDir1 = path.join(outputDir, __dirname); 
    const buggyDir2 = path.join(outputDir, __dirname, 'output');
    
    [outputDir, buggyDir1, buggyDir2].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // 엔진에게는 제일 단순한 파일명만 전달
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
                    fps: FPS
                }
            },
            {
                outFile: tempVideoName,
                quality: "high"
            }
        );

        console.log(`✅ 1차 비디오 렌더링(엔진 통과) 성공!`);

        // 🔥 영상이 저 기형적인 폴더들 중 어디에 처박혔는지 찾아서 정상 위치로 꺼내옵니다.
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
            // 구출한 파일을 YAML이 기다리고 있는 output/final_shorts.mp4 로 최종 이동
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