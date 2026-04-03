const fs = require('fs');
const path = require('path');

// Puppeteer 로드
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

// 💡 [핵심 해결] Xvfb 환경에 맞춘 완전한 해상도 고정 패치
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    return originalLaunch.call(puppeteer, {
        ...options,
        headless: false, // Xvfb(가상 디스플레이)를 쓰므로 false로 두어야 0x0 버그가 안 납니다!
        defaultViewport: { width: 1080, height: 1920 },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1080,1920',
            '--display=:99' // Xvfb 디스플레이 포트 강제 할당
        ]
    });
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 동적 코드 수신 및 조립 시작!");

    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "DynamicTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    // Base64 디코딩
    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    // 파일 생성 (번들러가 절대 경로로 확실히 잡을 수 있도록 src 폴더 생성 권장)
    const srcDir = path.join(__dirname, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);
    
    const entryPath = path.join(srcDir, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');
    console.log(`✅ 동적 템플릿 생성 완료: ${entryPath}`);

    const { renderTwickVideo } = await import('@twick/render-server');
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용 없음";
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    const tempVideoName = 'final_shorts.mp4';
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim();
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    const totalFrames = Math.ceil(estimatedSeconds * FPS);

    console.log(`🎬 렌더링 준비: ${totalFrames}프레임 (${estimatedSeconds}초)`);

    try {
        await renderTwickVideo({
            input: {
                entry: entryPath,
                properties: {
                    postTitle: title, 
                    postContent: cleanContent, 
                    cardBgColor: config?.cardBgColor || "#1a1a24"
                },
                durationInFrames: totalFrames, 
                fps: FPS, 
                width: 1080, 
                height: 1920
            }
        }, { 
            outFile: tempVideoName, 
            quality: "high" 
        });

        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
        const finalDest = path.join(outputDir, 'final_shorts.mp4');
        fs.renameSync(tempVideoName, finalDest);
        console.log(`✅ 비디오 렌더링 최종 성공! 파일 크기: ${fs.statSync(finalDest).size} bytes`);
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();