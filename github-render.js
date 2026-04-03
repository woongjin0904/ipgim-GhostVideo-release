// github-render.js
const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const safeArgs = (options?.args || []).filter(arg => !arg.includes('--headless'));
    const newOptions = {
        ...options,
        headless: false, 
        defaultViewport: null, 
        args: [ ...safeArgs, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1080,1920', '--autoplay-policy=no-user-gesture-required' ]
    };
    return originalLaunch.call(puppeteer, newOptions);
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 즉석 조립 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateCode = process.env.TEMPLATE_CODE; // 🔥 백엔드가 쏴준 코드 전문!
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    if (!templateCode) {
        console.error("❌ 치명적 오류: 백엔드로부터 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    // 🔥 작성자님의 기획 실현: 깃허브 서버에 즉석으로 동적 템플릿 파일을 생성합니다.
    const entryPath = path.join(__dirname, 'dynamic_template.jsx');
    fs.writeFileSync(entryPath, templateCode, 'utf8');
    console.log(`✅ 백엔드 데이터 수신 및 동적 템플릿 파일 생성 완료: ${entryPath}`);

    const outputDir = path.join(__dirname, 'output');
    [outputDir, path.join(outputDir, __dirname), path.join(outputDir, __dirname, 'output')].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    try {
        await renderTwickVideo({
            input: {
                entry: entryPath, // 🔥 즉석에서 생성한 파일을 주입
                properties: {
                    postTitle: title, postContent: cleanContent, views: "15,820", postUp: 940,
                    cardBgColor: config?.cardBgColor || "#1a1a24", config: config,
                    width: 1080, height: 1920, durationInFrames: totalFrames, fps: FPS
                },
                durationInFrames: totalFrames, duration: estimatedSeconds, frameCount: totalFrames, fps: FPS, width: 1080, height: 1920
            }
        }, { outFile: tempVideoName, quality: "high" });

        await new Promise(resolve => setTimeout(resolve, 2000));
        const finalDest = path.join(__dirname, 'output', 'final_shorts.mp4');
        const possiblePaths = [path.join(__dirname, tempVideoName), path.join(outputDir, tempVideoName)];

        let foundPath = possiblePaths.find(p => fs.existsSync(p));
        if (foundPath) {
            fs.renameSync(foundPath, finalDest);
            console.log(`📂 최종 파일 구출 완료! 크기: ${fs.statSync(finalDest).size} bytes`);
        } else {
            throw new Error("렌더링 결과 파일을 찾을 수 없습니다.");
        }
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
runGitHubRender();