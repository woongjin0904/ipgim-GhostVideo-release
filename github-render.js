const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

// 🔥 [핵심 2] 깡통 Chromium 대신 MP4 코덱이 있는 '진짜 크롬'을 사용하도록 몽키패치
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    return originalLaunch.call(puppeteer, {
        ...options,
        executablePath: '/usr/bin/google-chrome', // 리눅스에 설치된 실제 Chrome 경로
        headless: "new", 
        defaultViewport: { width: 1080, height: 1920 },
        args: [
            ...(options.args || []),
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1080,1920'
        ]
    });
};

async function runGitHubRender() {
    console.log("🚀 GitHub Actions: 동적 코드 수신 및 조립 시작!");

    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "PremiumStoryShortsTemplate";

    if (!encodedTemplateCode) {
        console.error("❌ 치명적 오류: 템플릿 코드를 전달받지 못했습니다.");
        process.exit(1);
    }

    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    const srcDir = path.join(__dirname, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
    
    // 유저의 원본 템플릿을 그대로 살립니다.
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
        if (fs.existsSync(tempVideoName)) {
            fs.renameSync(tempVideoName, finalDest);
            console.log(`✅ 비디오 렌더링 최종 성공! 파일 크기: ${fs.statSync(finalDest).size} bytes`);
        } else {
            throw new Error("렌더링은 완료되었으나 mp4 파일이 생성되지 않았습니다.");
        }
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();