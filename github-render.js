const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer'); 

// 브라우저 로그 후킹 유지 (디버깅용)
process.env.REMOTION_PUPPETEER_LOG_LEVEL = 'verbose';

// 💡 [핵심] 리눅스 가상 서버(GitHub Actions)에서 비디오 인코딩이 가능하도록 옵션 최적화
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const safeArgs = (options?.args || []).filter(arg => !arg.includes('--headless'));
    const newOptions = {
        ...options,
        headless: "new", 
        defaultViewport: { width: 1080, height: 1920 },
        args: [ 
            ...safeArgs, 
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--autoplay-policy=no-user-gesture-required',
            // ❌ '--disable-software-rasterizer' 절대 금지! (이것 때문에 0:00 영상이 만들어졌음)
            '--use-gl=swiftshader' // ✅ GPU가 없는 서버에서 WebCodecs가 화면을 안정적으로 그리도록 강제 설정
        ]
    };
    return originalLaunch.call(puppeteer, newOptions);
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 렌더링 엔진 가동 시작!");

    const { renderTwickVideo } = await import('@twick/render-server');

    // 환경 변수 파싱
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용이 없습니다.";
    const templateCode = process.env.TEMPLATE_CODE; 
    const configStr = process.env.POST_CONFIG || "{}";
    let config = {};
    try { config = JSON.parse(configStr); } catch(e) {}
    
    if (!templateCode) {
        console.error("❌ 템플릿 코드가 없습니다.");
        process.exit(1);
    }

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 💡 다시 포장지를 벗기고, 엔진이 요구하는 순수 컴포넌트 형태(Template.jsx)로 제공합니다.
    const templatePath = path.join(__dirname, 'Template.jsx');
    fs.writeFileSync(templatePath, templateCode, 'utf8');
    console.log(`✅ 프론트엔드 설정 동기화 완료!`);

    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    const propsData = {
        postTitle: title, 
        postContent: cleanContent, 
        views: "15,820", 
        postUp: 940,
        cardBgColor: config?.cardBgColor || "#1a1a24"
    };

    const tempVideoName = 'final_shorts.mp4';

    try {
        // 💡 엔진에게 Template.jsx 자체를 entry로 던져줍니다. 내부 Vite가 알아서 조립합니다.
        await renderTwickVideo({
            input: {
                entry: templatePath, 
                properties: propsData,
                durationInFrames: totalFrames, 
                fps: FPS, 
                width: 1080, 
                height: 1920
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