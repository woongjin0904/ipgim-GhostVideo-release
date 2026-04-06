const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const safeArgs = (options?.args || []).filter(arg => !arg.includes('--headless'));
    return originalLaunch.call(puppeteer, {
        ...options,
        headless: "new", 
        defaultViewport: { width: 1080, height: 1920 },
        args: [
            ...safeArgs, 
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--window-size=1080,1920', 
            '--autoplay-policy=no-user-gesture-required' 
        ]
    });
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateCode = process.env.TEMPLATE_CODE; 
    const config = JSON.parse(process.env.POST_CONFIG || "{}");
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!templateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    const entryPath = path.join(__dirname, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const tempVideoName = 'final_shorts.mp4';

    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    
    // 🔥 [핵심] 프론트엔드 에디터와 100% 동일한 방식으로 영상 길이를 계산합니다.
    const charsPerSecond = config?.charsPerSecond || 25;
    const paragraphLimit = config?.paragraphLimit || 4;
    const readingPauseSec = 1.5;

    const lines = cleanContent.split('\n');
    const pages = [];
    let tempLines = [];
    lines.forEach(line => {
      tempLines.push(line);
      if (tempLines.length >= paragraphLimit) { pages.push(tempLines.join('\n')); tempLines = []; }
    });
    if (tempLines.length > 0) pages.push(tempLines.join('\n'));
    if (pages.length === 0) pages.push("");

    let totalSec = 0;
    pages.forEach(text => { totalSec += (text.length / charsPerSecond) + readingPauseSec; });
    const estimatedSeconds = Math.max(totalSec, 5);
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 세팅: 속도 ${charsPerSecond}자/초 | ${totalFrames}프레임 (${estimatedSeconds}초)`);

    try {
        await renderTwickVideo({
            input: {
                entry: entryPath, 
                properties: {
                    postTitle: title, postContent: cleanContent, views: "15,820", postUp: 940,
                    cardBgColor: config?.cardBgColor || "#1a1a24",
                    paragraphLimit: paragraphLimit, charsPerSecond: charsPerSecond, // 🔥 속도값 주입
                    width: 1080, height: 1920, durationInFrames: totalFrames, fps: FPS
                },
                durationInFrames: totalFrames, duration: estimatedSeconds, frameCount: totalFrames, fps: FPS, width: 1080, height: 1920
            }
        }, { outFile: tempVideoName, quality: "high" });

        const expectedPath = path.join(outputDir, tempVideoName);
        const rootPath = path.join(__dirname, tempVideoName);

        if (fs.existsSync(expectedPath)) {
            console.log(`📂 최종 파일 렌더링 완료! 크기: ${fs.statSync(expectedPath).size} bytes`);
        } else if (fs.existsSync(rootPath)) {
            fs.renameSync(rootPath, expectedPath);
            console.log(`📂 최종 파일 렌더링 완료! 크기: ${fs.statSync(expectedPath).size} bytes`);
        } else {
            throw new Error("어디에도 렌더링된 파일이 없습니다.");
        }
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
runGitHubRender();