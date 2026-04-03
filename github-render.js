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

    // 🔥 엔진 경로 꼬임 버그 방지를 위해 1차적으로는 최상위 경로에 저장하도록 지시
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

        console.log(`✅ 1차 비디오 렌더링 성공!`);

        // 🔥 렌더링 성공 후 직접 output 폴더를 만들고 파일을 옮겨줍니다. (YAML 호환을 위함)
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const sourcePath = path.join(__dirname, tempVideoName);
        const destPath = path.join(outputDir, tempVideoName);
        
        // 파일 이동(rename)
        fs.renameSync(sourcePath, destPath);

        console.log(`📂 최종 파일 이동 완료! 저장 위치: ${destPath}`);

    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
 
runGitHubRender();