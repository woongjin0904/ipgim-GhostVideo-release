const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer'); 

process.env.REMOTION_PUPPETEER_LOG_LEVEL = 'verbose';

// 💡 720x1280 최적화 몽키 패치
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const newOptions = {
        ...options,
        headless: "new", 
        // 💡 중요: defaultViewport를 720x1280으로 강제 고정 (0 발생 방지)
        defaultViewport: { 
            width: 720, 
            height: 1280,
            isMobile: false,
            hasTouch: false 
        },
        args: [ 
            ...(options?.args || []).filter(arg => !arg.includes('--headless')), 
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--autoplay-policy=no-user-gesture-required',
            '--use-gl=swiftshader',
            '--hide-scrollbars',
            // 💡 창 크기도 720x1280으로 맞춤
            '--window-size=720,1280'
        ]
    };
    return originalLaunch.call(puppeteer, newOptions);
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: Twick 렌더링 엔진 (720x1280) 가동!");

    const { renderTwickVideo } = await import('@twick/render-server');

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

    const templatePath = path.join(__dirname, 'Template.jsx');
    fs.writeFileSync(templatePath, templateCode, 'utf8');

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
        await renderTwickVideo({
            input: {
                entry: templatePath, 
                properties: propsData,
                durationInFrames: totalFrames, 
                fps: FPS, 
                // 💡 엔진 렌더링 크기 수정
                width: 720, 
                height: 1280
            }
        }, { outFile: tempVideoName, quality: "high" });

        await new Promise(resolve => setTimeout(resolve, 2000));
        const finalDest = path.join(__dirname, 'output', 'final_shorts.mp4');
        const possiblePaths = [path.join(__dirname, tempVideoName), path.join(outputDir, tempVideoName)];

        let foundPath = possiblePaths.find(p => fs.existsSync(p));
        if (foundPath) {
            fs.renameSync(foundPath, finalDest);
            console.log(`📂 최종 파일 구출 완료!`);
        } else {
            throw new Error("렌더링 결과 파일을 찾을 수 없습니다.");
        }
    } catch (error) {
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
runGitHubRender();