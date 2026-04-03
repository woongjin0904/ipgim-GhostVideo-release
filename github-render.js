const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

// 💡 7.8KB를 추출해 냈던 가장 안정적인 세팅 유지
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
    console.log("🚀 GitHub Actions: Twick 조립 렌더링 엔진 가동 시작!");

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
    console.log(`✅ 템플릿 생성 완료: ${entryPath}`);

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 세팅: ${totalFrames}프레임 (${estimatedSeconds}초)`);

    try {
        await renderTwickVideo({
            input: {
                entry: entryPath, 
                properties: {
                    postTitle: title, 
                    postContent: cleanContent, 
                    views: "15,820", 
                    postUp: 940,
                    cardBgColor: config?.cardBgColor || "#1a1a24",
                    // 필수 파라미터가 누락되지 않도록 모두 주입
                    width: 1080, height: 1920, durationInFrames: totalFrames, fps: FPS
                },
                // 엔진이 0프레임으로 튕기지 않도록 성공했던 7KB 세팅의 파라미터를 그대로 복원
                durationInFrames: totalFrames, 
                duration: estimatedSeconds, 
                frameCount: totalFrames, 
                fps: FPS, 
                width: 1080, 
                height: 1920
            }
        }, { 
            outFile: path.join(outputDir, tempVideoName), 
            quality: "high" 
        });

        console.log(`📂 최종 파일 렌더링 완료!`);
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();