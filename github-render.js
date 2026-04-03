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
            '--window-size=1080,1920'
        ]
    });
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 동적 코드 수신 및 조립 시작!");

    // 🔥 1. 환경 변수로 전달받은 암호화된 코드를 꺼냅니다.
    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "DynamicTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    // 🔥 2. Base64 코드를 원래의 React 코드로 복구합니다.
    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    // 🔥 3. 엔진 가동 전, 즉석으로 .jsx 파일을 하드디스크에 생성합니다. (번들러 인식 완벽 성공)
    const entryPath = path.join(__dirname, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');
    console.log(`✅ 백엔드 코드 수신 완료. 동적 템플릿 생성됨: ${entryPath}`);

    // 이후 렌더링 로직
    const { renderTwickVideo } = await import('@twick/render-server');
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용 없음";
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    try {
        await renderTwickVideo({
            input: {
                entry: entryPath, // 🔥 방금 즉석에서 만든 파일을 타겟으로 지정!
                properties: {
                    postTitle: title, postContent: cleanContent, cardBgColor: config?.cardBgColor || "#1a1a24"
                },
                durationInFrames: totalFrames, fps: FPS, width: 1080, height: 1920
            }
        }, { outFile: tempVideoName, quality: "high" });

        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
        const finalDest = path.join(__dirname, 'output', 'final_shorts.mp4');
        if (fs.existsSync(tempVideoName)) {
            fs.renameSync(tempVideoName, finalDest);
            console.log(`✅ 동적 렌더링 완벽 성공! 파일 크기: ${fs.statSync(finalDest).size} bytes`);
        } else {
            throw new Error("결과물이 생성되지 않았습니다.");
        }
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}
runGitHubRender();