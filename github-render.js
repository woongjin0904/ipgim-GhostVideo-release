const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch(e) { puppeteer = require('puppeteer'); }

// 💡 [원상 복구] 회원님이 성공하셨던 심플한 퍼피티어 패치로 돌아갑니다.
const originalLaunch = puppeteer.launch;
puppeteer.launch = async function(options) {
    const safeArgs = (options?.args || []).filter(arg => !arg.includes('--headless'));
    return originalLaunch.call(puppeteer, {
        ...options,
        headless: "new", // 원래 성공했던 세팅
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
    console.log("🚀 GitHub Actions: Twick 즉석 조립 렌더링 엔진 가동 시작!");

    const encodedTemplateCode = process.env.TEMPLATE_CODE; 
    const templateName = process.env.TEMPLATE_NAME || "StoryShorts";

    if (!encodedTemplateCode) {
        console.error("❌ 템플릿 코드 누락");
        process.exit(1);
    }

    const templateCode = Buffer.from(encodedTemplateCode, 'base64').toString('utf8');
    
    // 원래 위치에 템플릿 파일 생성
    const entryPath = path.join(__dirname, `${templateName}.jsx`);
    fs.writeFileSync(entryPath, templateCode, 'utf8');
    console.log(`✅ 템플릿 파일 정상 복호화 및 생성 완료: ${entryPath}`);

    const { renderTwickVideo } = await import('@twick/render-server');
    const title = process.env.POST_TITLE || "제목 없음";
    const content = process.env.POST_CONTENT || "내용 없음";
    const config = JSON.parse(process.env.POST_CONFIG || "{}");

    // 💡 [0:00 버그 픽스 1] 내용이 비어있으면 기본값 보장
    const cleanContent = content.replace(/[ \t]+/g, ' ').trim() || "내용이 없습니다.";
    
    const FPS = 30;
    const estimatedSeconds = Math.max(cleanContent.length / 15, 5) + 2; 
    
    // 💡 [0:00 버그 픽스 2] 프레임 수가 소수점이 되면 인코더가 0프레임으로 인식하므로 강제 정수화(Floor)
    const totalFrames = Math.floor(estimatedSeconds * FPS); 

    console.log(`🎬 렌더링 준비: ${totalFrames}프레임 (${estimatedSeconds}초)`);

    try {
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        
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
            outFile: path.join(outputDir, 'final_shorts.mp4'), 
            quality: "high" 
        });

        console.log(`✅ 비디오 렌더링 완료!`);
        
    } catch (error) { 
        console.error(`❌ 비디오 렌더링 실패:`, error);
        process.exit(1);
    }
}

runGitHubRender();